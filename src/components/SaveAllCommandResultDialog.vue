<template>
  <q-dialog persistent ref="dialogRef" @hide="onDialogHide">
    <!-- 仮デザイン -->
    <q-layout container class="q-dialog-plugin bg-white">
      <q-header>
        <q-toolbar>
          <q-toolbar-title>音声書き出し結果</q-toolbar-title>
        </q-toolbar>
        <q-space />
      </q-header>
      <q-page-container>
        <q-page>
          <q-list separator v-if="writeErrorArray.length > 0">
            <div class="error">書き込みエラーによって失敗しました:</div>
            <q-item v-for="(value, index) in writeErrorArray" :key="index">
              <q-item-section>
                <q-item-label>{{ value }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
          <q-list separator v-if="engineErrorArray.length > 0">
            <div class="error">エンジンエラーによって失敗しました:</div>
            <q-item v-for="(value, index) in engineErrorArray" :key="index">
              <q-item-section>
                <q-item-label>{{ value }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
          <q-list separator v-if="successArray.length > 0">
            <div class="success">成功:</div>
            <q-item v-for="(value, index) in successArray" :key="index">
              <q-item-section>
                <q-item-label>{{ value }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-page>
      </q-page-container>
      <q-footer>
        <q-item clickable v-ripple align="right" @click="close">
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

.q-page-container {
  margin-top: 1em;
}

.q-item {
  border-bottom: solid 0.1rem global.$primary;
}

.success {
  color: green;
}

.error {
  color: red;
}
</style>
