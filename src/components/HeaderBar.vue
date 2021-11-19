<template>
  <q-header class="q-py-sm">
    <q-toolbar>
      <template v-for="button in headerButtons" :key="button.text">
        <q-space v-if="button.text === null" />
        <q-btn
          v-else
          unelevated
          color="background-light"
          text-color="display-dark"
          class="text-no-wrap text-bold q-mr-sm"
          :disable="button.disable.value"
          @click="button.click"
          >{{ button.text }}</q-btn
        >
      </template>
    </q-toolbar>
  </q-header>
</template>

<script lang="ts">
import { defineComponent, computed, ComputedRef } from "vue";
import { useStore } from "@/store";
import { useQuasar } from "quasar";
import { setHotkeyFunctions } from "@/store/setting";
import {
  HotkeyAction,
  HotkeyReturnType,
  ToolbarButtonsType,
} from "@/type/preload";
import { SaveResultObject } from "@/store/type";

type ButtonContent =
  | {
      text: ToolbarButtonsType;
      click(): void;
      disable: ComputedRef<boolean>;
    }
  | {
      text: null;
    };

export default defineComponent({
  setup() {
    const store = useStore();
    const $q = useQuasar();

    const uiLocked = computed(() => store.getters.UI_LOCKED);
    const canUndo = computed(() => store.getters.CAN_UNDO);
    const canRedo = computed(() => store.getters.CAN_REDO);
    const nowPlayingContinuously = computed(
      () => store.state.nowPlayingContinuously
    );
    const activeAudioKey = computed(() => store.getters.ACTIVE_AUDIO_KEY);
    const nowPlaying = computed(() =>
      activeAudioKey.value
        ? store.state.audioStates[activeAudioKey.value]?.nowPlaying
        : false
    );
    const toolbarSetting = computed(() => store.state.toolbarSetting);

    let continuouslyFlag = true;

    const undoRedoHotkeyMap = new Map<HotkeyAction, () => HotkeyReturnType>([
      // undo
      [
        "元に戻す",
        () => {
          if (!uiLocked.value && canUndo.value) {
            undo();
          }
          return false;
        },
      ],
      // redo
      [
        "やり直す",
        () => {
          if (!uiLocked.value && canRedo.value) {
            redo();
          }
          return false;
        },
      ],
    ]);
    setHotkeyFunctions(undoRedoHotkeyMap);

    const hotkeyMap = new Map<HotkeyAction, () => HotkeyReturnType>([
      // play/stop continuously
      [
        "連続再生/停止",
        () => {
          if (!uiLocked.value) {
            if (nowPlayingContinuously.value) {
              stop();
            } else {
              playContinuously();
            }
          }
        },
      ],
    ]);

    setHotkeyFunctions(hotkeyMap);

    const undo = () => {
      store.dispatch("UNDO");
    };
    const redo = () => {
      store.dispatch("REDO");
    };
    const playAudio = async () => {
      try {
        if (continuouslyFlag) {
          await store.dispatch("PLAY_CONTINUOUSLY_AUDIO");
        } else if (activeAudioKey.value !== undefined) {
          await store.dispatch("PLAY_AUDIO", {
            audioKey: activeAudioKey.value,
          });
        } else {
          throw Error();
        }
      } catch {
        $q.dialog({
          title: "再生に失敗しました",
          message: "エンジンの再起動をお試しください。",
          ok: {
            label: "閉じる",
            flat: true,
            textColor: "display",
          },
        });
      }
    };
    const playContinuously = async () => {
      continuouslyFlag = true;
      await playAudio();
    };
    const play = async () => {
      continuouslyFlag = false;
      await playAudio();
    };
    const stop = () => {
      if (continuouslyFlag) {
        store.dispatch("STOP_CONTINUOUSLY_AUDIO");
      } else if (activeAudioKey.value !== undefined) {
        store.dispatch("STOP_AUDIO", { audioKey: activeAudioKey.value });
      }
    };
    const generateAndSaveAllAudio = async () => {
      await store.dispatch("GENERATE_AND_SAVE_ALL_AUDIO_WITH_DIALOG", {
        encoding: store.state.savingSetting.fileEncoding,
        $q,
      });
    };
    const generateAndSaveOneAudio = async () => {
      const result: SaveResultObject = await store.dispatch(
        "GENERATE_AND_SAVE_AUDIO",
        {
          audioKey: activeAudioKey.value as string,
          encoding: store.state.savingSetting.fileEncoding,
        }
      );
      if (result.result === "SUCCESS" || result.result === "CANCELED") return;
      let msg = "";
      switch (result.result) {
        case "WRITE_ERROR":
          msg =
            "書き込みエラーによって失敗しました。空き容量があることや、書き込み権限があることをご確認ください。";
          break;
        case "ENGINE_ERROR":
          msg =
            "エンジンのエラーによって失敗しました。エンジンの再起動をお試しください。";
          break;
      }
      $q.dialog({
        title: "書き出しに失敗しました。",
        message: msg,
        ok: {
          label: "閉じる",
          flat: true,
          textColor: "secondary",
        },
      });
    };
    const importTextFile = () => {
      store.dispatch("COMMAND_IMPORT_FROM_FILE", {});
    };

    const usableButtons: ButtonContent[] = [
      {
        text: "連続再生",
        click: playContinuously,
        disable: uiLocked,
      },
      {
        text: "再生",
        click: play,
        disable: computed(() => !activeAudioKey.value || uiLocked.value),
      },
      {
        text: "停止",
        click: stop,
        disable: computed(
          () => !nowPlayingContinuously.value && !nowPlaying.value
        ),
      },
      {
        text: "音声書き出し",
        click: generateAndSaveAllAudio,
        disable: uiLocked,
      },
      {
        text: "一つだけ書き出し",
        click: generateAndSaveOneAudio,
        disable: computed(() => !activeAudioKey.value || uiLocked.value),
      },
      {
        text: "元に戻す",
        click: undo,
        disable: computed(() => !canUndo.value || uiLocked.value),
      },
      {
        text: "やり直す",
        click: redo,
        disable: computed(() => !canRedo.value || uiLocked.value),
      },
      {
        text: "テキスト読み込み",
        click: importTextFile,
        disable: uiLocked,
      },
    ];

    const searchButton = (button: ToolbarButtonsType): ButtonContent => {
      if (button === "空白") {
        return {
          text: null,
        };
      } else {
        return usableButtons.find((b) => b.text === button) as ButtonContent;
      }
    };

    const headerButtons = computed(() =>
      toolbarSetting.value.buttons.map(searchButton)
    );

    return {
      headerButtons,
    };
  },
});
</script>
