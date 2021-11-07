<template>
  <q-header class="q-py-sm">
    <q-toolbar>
      <q-btn
        unelevated
        color="display-light"
        text-color="display-dark"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="uiLocked"
        @click="playContinuously"
        >連続再生</q-btn
      >
      <q-btn
        unelevated
        color="display-light"
        text-color="display-dark"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="!nowPlayingContinuously"
        @click="stopContinuously"
        >停止</q-btn
      >

      <q-space />
      <q-btn
        v-if="useUndoRedo"
        unelevated
        color="display-light"
        text-color="display-dark"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="!canUndo || uiLocked"
        @click="undo"
        >元に戻す</q-btn
      >
      <q-btn
        v-if="useUndoRedo"
        unelevated
        color="display-light"
        text-color="display-dark"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="!canRedo || uiLocked"
        @click="redo"
        >やり直す</q-btn
      >
    </q-toolbar>
  </q-header>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";
import { useQuasar } from "quasar";
import { setHotkeyFunctions } from "@/store/setting";
import { HotkeyAction, HotkeyReturnType } from "@/type/preload";

export default defineComponent({
  setup() {
    const store = useStore();
    const $q = useQuasar();

    const useUndoRedo = computed(() => store.state.useUndoRedo);

    const uiLocked = computed(() => store.getters.UI_LOCKED);
    const canUndo = computed(() => store.getters.CAN_UNDO);
    const canRedo = computed(() => store.getters.CAN_REDO);
    const nowPlayingContinuously = computed(
      () => store.state.nowPlayingContinuously
    );

    if (useUndoRedo.value) {
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
    }

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
      if (useUndoRedo.value) {
        store.dispatch("UNDO");
      }
    };
    const redo = () => {
      if (useUndoRedo.value) {
        store.dispatch("REDO");
      }
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
            textColor: "secondary",
          },
        });
      }
    };
    const stopContinuously = () => {
      store.dispatch("STOP_CONTINUOUSLY_AUDIO");
    };

    return {
      useUndoRedo,
      uiLocked,
      canUndo,
      canRedo,
      nowPlayingContinuously,
      undo,
      redo,
      playContinuously,
      stopContinuously,
    };
  },
});
</script>
