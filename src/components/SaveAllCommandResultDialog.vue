<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-layout container class="q-dialog-plugin bg-white">
      <q-header>
        <q-toolbar>
          <q-toolbar-title>音声書き出し結果</q-toolbar-title>
        </q-toolbar>
        <q-space />
      </q-header>
      <q-page-container>
        <q-page>
          <q-list bordered separator>
            <q-item v-for="(value, index) in successArray" :key="index">
              <q-item-section>
                <q-item-label
                  ><div class="success">成功:</div>
                  {{ value }}</q-item-label
                >
              </q-item-section>
            </q-item>
          </q-list>
          <q-list bordered separator>
            <q-item v-for="(value, index) in writeErrorArray" :key="index">
              <q-item-section>
                <q-item-label
                  ><div class="write-error">書き込みエラー:</div>
                  {{ value }}</q-item-label
                >
              </q-item-section>
            </q-item>
          </q-list>
          <q-list bordered separator>
            <q-item v-for="(value, index) in engineErrorArray" :key="index">
              <q-item-section>
                <q-item-label
                  ><div class="engine-error">エンジンエラー:</div>
                  {{ value }}</q-item-label
                >
              </q-item-section>
            </q-item>
          </q-list>
        </q-page>
      </q-page-container>
      <q-space />
      <q-footer>
        <q-item clickable v-ripple align="center" @click="close">
          <q-item-section>閉じる</q-item-section>
        </q-item>
      </q-footer>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useDialogPluginComponent } from "quasar";

export default defineComponent({
  name: "SaveAllCommandResultDialog",
  props: {
    successArray: Array,
    writeErrorArray: Array,
    engineErrorArray: Array,
  },
  emits: {
    ...useDialogPluginComponent.emits,
  },
  setup() {
    const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
    const close = () => onDialogOK();
    return {
      dialogRef,
      onDialogHide,
      close,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;

.q-list {
  border: global.$primary;
}

.success {
  color: green;
}

.engine-error {
  color: red;
}

.write-error {
  color: yellow;
}
</style>
