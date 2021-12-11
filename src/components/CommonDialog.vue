<template>
  <q-dialog :persistent="persistent" ref="dialogRef">
    <q-card>
      <q-card-section class="text-h6 bg-primary q-py-sm">{{
        title
      }}</q-card-section>
      <q-card-section class="q-py-none q-my-md message">{{
        message
      }}</q-card-section>
      <q-card-actions>
        <q-space />
        <q-btn
          v-if="cancelable"
          flat
          dense
          text-color="display"
          :label="cancelButtonText ?? 'キャンセル'"
          @click="cancel"
        />
        <q-btn
          flat
          dense
          text-color="display"
          :label="okButtonText ?? 'OK'"
          @click="ok"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useDialogPluginComponent } from "quasar";

export default defineComponent({
  name: "CommonDialog",

  props: {
    title: String,
    message: String,
    persistent: Boolean,
    cancelable: Boolean,
    okButtonText: String,
    cancelButtonText: String,
  },

  setup() {
    const { dialogRef, onDialogOK } = useDialogPluginComponent();

    const ok = () => onDialogOK({ result: "ok" });
    const cancel = () => onDialogOK({ result: "cancel" });

    return {
      dialogRef,
      ok,
      cancel,
    };
  },
});
</script>

<style scoped lang="scss">
.q-card {
  min-width: 400px;
}
.message {
  white-space: pre-wrap;
}
</style>
