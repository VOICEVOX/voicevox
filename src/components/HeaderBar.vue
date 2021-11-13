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
import { HotkeyAction, HotkeyReturnType } from "@/type/preload";

type ButtonContent =
  | {
      text: string;
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

    const headerButtons: ButtonContent[] = [
      {
        text: "連続再生",
        click: playContinuously,
        disable: uiLocked,
      },
      {
        text: "停止",
        click: stopContinuously,
        disable: computed(() => !nowPlayingContinuously.value),
      },
      {
        text: null,
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
    ];

    return {
      headerButtons,
    };
  },
});
</script>
