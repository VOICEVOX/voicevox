<template>
  <q-dialog ref="dialogRef" persistent>
    <q-layout
      container
      view="hhh lpr fFf"
      class="q-dialog-plugin bg-background"
    >
      <q-page-container class="q-px-md">
        <h5 class="text-h5 q-my-md">音声書き出し結果</h5>
        <q-expansion-item
          v-if="props.writeErrorArray.length > 0"
          :label="`${props.writeErrorArray.length}件の書き込みエラーによる失敗`"
          header-class="text-warning"
        >
          <q-list separator>
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
        </q-expansion-item>
        <q-expansion-item
          v-if="props.engineErrorArray.length > 0"
          :label="`${props.engineErrorArray.length}件のエンジンエラーによる失敗`"
          header-class="text-warning"
        >
          <q-list separator>
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
        </q-expansion-item>
        <q-expansion-item :label="`${props.successArray.length}件の成功`">
          <q-list v-if="props.successArray.length > 0" separator>
            <q-item v-for="(value, index) in props.successArray" :key="index">
              <q-item-section>
                <q-item-label>{{ value }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-expansion-item>
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

.q-item:not(.q-item:last-child) {
  border-bottom: solid 0.1rem rgba(colors.$display-rgb, 0.15);
}
</style>
