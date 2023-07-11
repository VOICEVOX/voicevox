<template>
  <q-dialog ref="dialogRef" persistent>
    <q-layout container class="q-dialog-plugin bg-background">
      <q-page-container>
        <q-page class="q-px-md">
          <h5 class="text-h5 q-my-md">音声書き出し結果</h5>
          <q-list v-if="props.writeErrorArray.length > 0" separator>
            <div class="text-warning">失敗（書き込みエラー）:</div>
            <q-item
              v-for="(value, index) in props.writeErrorArray"
              :key="index"
            >
              <q-item-section>
                <q-item-label>{{ value.path }}</q-item-label>
                <q-item-label>詳細：{{ value.message }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
          <q-list v-if="props.engineErrorArray.length > 0" separator>
            <div class="text-warning">失敗（エンジンエラー）:</div>
            <q-item
              v-for="(value, index) in props.engineErrorArray"
              :key="index"
            >
              <q-item-section>
                <q-item-label>{{ value.path }}</q-item-label>
                <q-item-label v-if="value.message"
                  >詳細：{{ value.message }}</q-item-label
                >
              </q-item-section>
            </q-item>
          </q-list>
          <q-list v-if="props.successArray.length > 0" separator>
            <div class="text-primary">成功:</div>
            <q-item v-for="(value, index) in props.successArray" :key="index">
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
          <q-btn flat dense align="right" label="閉じる" @click="close" />
        </q-toolbar>
      </q-footer>
    </q-layout>
  </q-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from "quasar";
import { ErrorTypeForSaveAllResultDialog } from "@/store/type";

const props =
  defineProps<{
    successArray: string | undefined[];
    writeErrorArray: ErrorTypeForSaveAllResultDialog[];
    engineErrorArray: ErrorTypeForSaveAllResultDialog[];
  }>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const close = () => onDialogOK();
</script>

<style scoped lang="scss">
@use '@/styles/colors' as colors;

.q-page-container {
  margin-top: 0;
  padding-bottom: 34px !important;
}
.q-item:not(.q-item:last-child) {
  border-bottom: solid 0.1rem rgba(colors.$display-rgb, 0.15);
}
.q-list:not(.q-list:last-child) {
  border-bottom: solid 0.1rem rgba(colors.$primary-rgb, 0.5);
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
}
</style>
