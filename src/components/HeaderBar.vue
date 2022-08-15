<template>
  <q-header class="q-py-sm">
    <q-toolbar>
      <template v-for="button in headerButtons" :key="button.text">
        <q-space v-if="button.text === null" />
        <q-btn
          v-else
          unelevated
          color="toolbar-button"
          text-color="toolbar-button-display"
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
  ToolbarButtonTagType,
} from "@/type/preload";
import {
  generateAndConnectAndSaveAudioWithDialog,
  generateAndSaveAllAudioWithDialog,
  generateAndSaveOneAudioWithDialog,
} from "@/components/Dialog";
import { getToolbarButtonName } from "@/store/utility";

type ButtonContent = {
  text: string;
  click(): void;
  disable: ComputedRef<boolean>;
};

type SpacerContent = {
  text: null;
};

export default defineComponent({
  setup() {
    const store = useStore();
    const $q = useQuasar();

    const uiLocked = computed(() => store.getters.UI_LOCKED);
    const canUndo = computed(() => store.getters.CAN_UNDO);
    const canRedo = computed(() => store.getters.CAN_REDO);
    const activeAudioKey = computed(() => store.getters.ACTIVE_AUDIO_KEY);
    const nowPlayingContinuously = computed(
      () => store.state.nowPlayingContinuously
    );

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
              stopContinuously();
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
    const playContinuously = async () => {
      try {
        await store.dispatch("PLAY_CONTINUOUSLY_AUDIO");
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
    const stopContinuously = () => {
      store.dispatch("STOP_CONTINUOUSLY_AUDIO");
    };
    const generateAndSaveOneAudio = async () => {
      await generateAndSaveOneAudioWithDialog({
        audioKey: activeAudioKey.value as string,
        quasarDialog: $q.dialog,
        dispatch: store.dispatch,
        encoding: store.state.savingSetting.fileEncoding,
      });
    };
    const generateAndSaveAllAudio = async () => {
      await generateAndSaveAllAudioWithDialog({
        quasarDialog: $q.dialog,
        dispatch: store.dispatch,
        encoding: store.state.savingSetting.fileEncoding,
      });
    };
    const generateAndConnectAndSaveAudio = async () => {
      await generateAndConnectAndSaveAudioWithDialog({
        quasarDialog: $q.dialog,
        dispatch: store.dispatch,
        encoding: store.state.savingSetting.fileEncoding,
      });
    };
    const saveProject = async () => {
      await store.dispatch("SAVE_PROJECT_FILE", { overwrite: true });
    };
    const importTextFile = () => {
      store.dispatch("COMMAND_IMPORT_FROM_FILE", {});
    };

    const usableButtons: Record<
      ToolbarButtonTagType,
      Omit<ButtonContent, "text"> | null
    > = {
      PLAY_CONTINUOUSLY: {
        click: playContinuously,
        disable: uiLocked,
      },
      STOP: {
        click: stopContinuously,
        disable: computed(() => !nowPlayingContinuously.value),
      },
      EXPORT_AUDIO_ONE: {
        click: generateAndSaveOneAudio,
        disable: computed(() => !activeAudioKey.value || uiLocked.value),
      },
      EXPORT_AUDIO_ALL: {
        click: generateAndSaveAllAudio,
        disable: uiLocked,
      },
      EXPORT_AUDIO_CONNECT_ALL: {
        click: generateAndConnectAndSaveAudio,
        disable: uiLocked,
      },
      SAVE_PROJECT: {
        click: saveProject,
        disable: uiLocked,
      },
      UNDO: {
        click: undo,
        disable: computed(() => !canUndo.value || uiLocked.value),
      },
      REDO: {
        click: redo,
        disable: computed(() => !canRedo.value || uiLocked.value),
      },
      IMPORT_TEXT: {
        click: importTextFile,
        disable: uiLocked,
      },
      EMPTY: null,
    };

    const headerButtons = computed(() =>
      store.state.toolbarSetting.map<ButtonContent | SpacerContent>((tag) => {
        const buttonContent = usableButtons[tag];
        if (buttonContent) {
          return {
            ...buttonContent,
            text: getToolbarButtonName(tag),
          };
        } else {
          return {
            text: null,
          };
        }
      })
    );

    return {
      headerButtons,
    };
  },
});
</script>
