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
      >
        {{ t("header_bar.play") }}
      </q-btn>
      <q-btn
        unelevated
        color="background-light"
        text-color="display-dark"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="!nowPlayingContinuously"
        @click="stopContinuously"
      >
        {{ t("header_bar.stop") }}
      </q-btn>

      <q-space />
      <q-btn
        unelevated
        color="background-light"
        text-color="display-dark"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="!canUndo || uiLocked"
        @click="undo"
      >
        {{ t("header_bar.undo") }}
      </q-btn>
      <q-btn
        unelevated
        color="background-light"
        text-color="display-dark"
        class="text-no-wrap text-bold q-mr-sm"
        :disable="!canRedo || uiLocked"
        @click="redo"
      >
        {{ t("header_bar.redo") }}
      </q-btn>
    </q-toolbar>
  </q-header>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";
import { useQuasar } from "quasar";
import { setHotkeyFunctions } from "@/store/setting";
import { HotkeyAction, HotkeyReturnType } from "@/type/preload";
import { MessageSchema } from "@/i18n";
import { useI18n } from "vue-i18n";

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
        "undo",
        () => {
          if (!uiLocked.value && canUndo.value) {
            undo();
          }
          return false;
        },
      ],
      // redo
      [
        "redo",
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
        "togglePlaybackCon",
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
          title: t("dialogs.play_failed.title"),
          message: t("dialogs.play_failed.msg"),
          ok: {
            label: t("dialogs.play_failed.close"),
            flat: true,
            textColor: "display",
          },
        });
      }
    };
    const stopContinuously = () => {
      store.dispatch("STOP_CONTINUOUSLY_AUDIO");
    };

    const { t } = useI18n<{ message: MessageSchema }>({
      useScope: "global",
    });

    return {
      uiLocked,
      canUndo,
      canRedo,
      nowPlayingContinuously,
      undo,
      redo,
      playContinuously,
      stopContinuously,
      t,
    };
  },
});
</script>
