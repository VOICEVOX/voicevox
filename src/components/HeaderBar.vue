<template>
  <q-header class="q-py-sm">
    <q-toolbar>
      <q-btn
        unelevated
        color="background-light"
        text-color="display-dark"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="uiLocked"
        @click="playContinuously"
        >連続再生</q-btn
      >
      <q-btn
        unelevated
        color="background-light"
        text-color="display-dark"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="!nowPlayingContinuously"
        @click="stopContinuously"
        >停止</q-btn
      >

      <q-space />
      <q-btn
        unelevated
        color="background-light"
        text-color="display-dark"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="!canUndo || uiLocked"
        @click="undo"
        >元に戻す</q-btn
      >
      <q-btn
        unelevated
        color="background-light"
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
import { setHotkeyFunctions } from "@/store/setting";
import { HotkeyAction, HotkeyReturnType } from "@/type/preload";

export default defineComponent({
  setup() {
    const store = useStore();

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
        store.dispatch("OPEN_COMMON_DIALOG", {
          title: "再生に失敗しました",
          message: "エンジンの再起動をお試しください。",
          okButtonText: "閉じる",
        });
      }
    };
    const stopContinuously = () => {
      store.dispatch("STOP_CONTINUOUSLY_AUDIO");
    };

    return {
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
