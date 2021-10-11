<template>
  <q-header class="q-py-sm">
    <q-toolbar>
      <q-btn
        unelevated
        color="accent"
        text-color="secondary"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="uiLocked"
        @click="playContinuously"
        >連続再生</q-btn
      >
      <q-btn
        unelevated
        color="accent"
        text-color="secondary"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="!nowPlayingContinuously"
        @click="stopContinuously"
        >停止</q-btn
      >

      <q-space />
      <q-btn
        v-if="useUndoRedo"
        unelevated
        color="accent"
        text-color="secondary"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="!canUndo || uiLocked"
        @click="undo"
        >元に戻す</q-btn
      >
      <q-btn
        v-if="useUndoRedo"
        unelevated
        color="accent"
        text-color="secondary"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="!canRedo || uiLocked"
        @click="redo"
        >やり直す</q-btn
      >
      <q-btn
        v-if="darkModeComputed"
        icon="light_mode"
        flat
        round
        @click="darkModeComputed = false"
      />
      <q-btn
        v-else
        icon="dark_mode"
        flat
        round
        @click="darkModeComputed = true"
      />
    </q-toolbar>
  </q-header>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";
import { useQuasar, setCssVar, colors } from "quasar";

export default defineComponent({
  setup() {
    const store = useStore();
    const $q = useQuasar();

    const useUndoRedo = computed(() => store.state.useUndoRedo);

    const uiLocked = computed(() => store.getters.UI_LOCKED);
    const canUndo = computed(() => store.getters.CAN_UNDO);
    const canRedo = computed(() => store.getters.CAN_REDO);

    const { getPaletteColor } = colors;
    const darkModeComputed = computed({
      get: () => {
        if (store.state.darkMode) {
          setCssVar("primary", getPaletteColor("black"));
          setCssVar("secondary", "#ffffff");
          setCssVar("accent", getPaletteColor("dark"));
          setCssVar("info", getPaletteColor("grey-10"));
          setCssVar("positive", getPaletteColor("grey-3"));
        } else {
          setCssVar("primary", "#a5d4ad");
          setCssVar("secondary", "#212121");
          setCssVar("accent", getPaletteColor("white"));
          setCssVar("info", getPaletteColor("grey-3"));
          setCssVar("positive", "#a5d4ad");
        }
        $q.dark.set(store.state.darkMode);
        return store.state.darkMode;
      },
      set: (val) => {
        $q.dark.set(val);
        store.dispatch("SET_DARK_MODE", { darkMode: val });
      },
    });
    const nowPlayingContinuously = computed(
      () => store.state.nowPlayingContinuously
    );

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
      darkModeComputed,
    };
  },
});
</script>
