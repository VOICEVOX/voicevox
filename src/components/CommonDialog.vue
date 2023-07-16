<template>
  <span></span>
</template>

<script setup lang="ts">
import { useQuasar } from "quasar";
import { watch } from "vue";
import { useStore } from "vuex";
import { UiStoreState } from "@/store/type";

const store = useStore<UiStoreState>();
const $q = useQuasar();
const showDialog = {
  alert: (options: { title: string; message: string; ok?: string }) =>
    $q
      .dialog({
        title: options.title,
        message: options.message,
        ok: {
          label: options.ok ?? "閉じる",
          flat: true,
          textColor: "display",
        },
      })
      .onOk(() => {
        store.dispatch("CLOSE_DIALOG", { result: "OK" });
      }),
  confirm: (options: {
    title: string;
    message: string;
    html?: boolean;
    actionName: string;
    cancel?: string;
  }) =>
    $q
      .dialog({
        title: options.title,
        message: options.message,
        persistent: true, // ダイアログ外側押下時・Esc押下時にユーザが設定ができたと思い込むことを防止する
        focus: "cancel",
        html: options.html,
        ok: {
          flat: true,
          label: options.actionName,
          textColor: "display",
        },
        cancel: {
          flat: true,
          label: options.cancel ?? "キャンセル",
          textColor: "display",
        },
      })
      .onOk(() => {
        store.dispatch("CLOSE_DIALOG", { result: "OK" });
      })
      .onCancel(() => {
        store.dispatch("CLOSE_DIALOG", { result: "CANCEL" });
      }),
  warning: (options: {
    title: string;
    message: string;
    actionName: string;
    cancel?: string;
  }) =>
    $q
      .dialog({
        title: options.title,
        message: options.message,
        persistent: true,
        focus: "cancel",
        ok: {
          label: options.actionName,
          flat: true,
          textColor: "warning",
        },
        cancel: {
          label: options.cancel ?? "キャンセル",
          flat: true,
          textColor: "display",
        },
      })
      .onOk(() => {
        store.dispatch("CLOSE_DIALOG", { result: "OK" });
      })
      .onCancel(() => {
        store.dispatch("CLOSE_DIALOG", { result: "CANCEL" });
      }),
};

watch(
  () => store.state.dialogOption,
  (dialogOption) => {
    // 分けないとtype errorになるため
    switch (dialogOption?.type) {
      case undefined:
        return;
      case "alert":
        showDialog[dialogOption.type](dialogOption);
        return;
      case "confirm":
        showDialog[dialogOption.type](dialogOption);
        return;
      case "warning":
        showDialog[dialogOption.type](dialogOption);
        return;
    }
  },
  { immediate: true }
);
</script>
