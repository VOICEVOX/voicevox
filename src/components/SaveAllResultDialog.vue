<template>
  <q-dialog persistent ref="dialogRef">
    <!-- 仮デザイン -->
    <q-layout container class="q-dialog-plugin background">
      <q-header>
        <q-toolbar>
          <q-toolbar-title class="header-text"
            >音声書き出し結果</q-toolbar-title
          >
        </q-toolbar>
        <q-space />
      </q-header>
      <q-page-container>
        <q-page>
          <q-list separator v-if="writeErrorArray.length > 0">
            <div class="error">失敗（書き込みエラー）:</div>
            <q-item v-for="(value, index) in writeErrorArray" :key="index">
              <q-item-section>
                <q-item-label>{{ value }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
          <q-list separator v-if="engineErrorArray.length > 0">
            <div class="error">失敗（エンジンエラー）:</div>
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
        <q-toolbar>
          <q-space />
          <q-btn flat dense align="right" @click="close" label="閉じる" />
        </q-toolbar>
      </q-footer>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useDialogPluginComponent } from "quasar";

export default defineComponent({
  name: "SaveAllResultDialog",
  props: {
    successArray: Array,
    writeErrorArray: Array,
    engineErrorArray: Array,
  },
  emits: {
    ...useDialogPluginComponent.emits,
  },
  setup() {
    const { dialogRef, onDialogOK } = useDialogPluginComponent();
    const close = () => onDialogOK();
    return {
      dialogRef,
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

.header-text {
  color: var(--color-display);
}

.background {
  background-color: var(--color-background);
}
</style>
