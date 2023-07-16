<template>
  <span></span>
</template>

<script setup lang="ts">
import { useQuasar } from "quasar";

defineExpose({
  showAlert: (options: { title: string; message: string; ok?: string }) =>
    $q.dialog({
      title: options.title,
      message: options.message,
      ok: {
        label: options.ok ?? "閉じる",
        flat: true,
        textColor: "display",
      },
    }),
  showConfirm: (options: {
    title: string;
    message: string;
    html?: boolean;
    actionName: string;
    cancel?: string;
  }) =>
    $q.dialog({
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
    }),
  showWarning: (options: {
    title: string;
    message: string;
    actionName: string;
    cancel?: string;
  }) =>
    $q.dialog({
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
    }),
});

const $q = useQuasar();
</script>
