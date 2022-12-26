<template>
  <QDialog persistent ref="dialogRef">
    <!-- 仮デザイン -->
    <QLayout container class="q-dialog-plugin bg-background">
      <QHeader>
        <QToolbar>
          <QToolbarTitle class="text-display">音声書き出し結果</QToolbarTitle>
        </QToolbar>
        <QSpace />
      </QHeader>
      <QPageContainer>
        <QPage>
          <QList separator v-if="writeErrorArray.length > 0">
            <div class="error">失敗（書き込みエラー）:</div>
            <QItem v-for="(value, index) in writeErrorArray" :key="index">
              <QItemSection>
                <QItemLabel>{{ value.path }}</QItemLabel>
                <QItemLabel>詳細：{{ value.message }}</QItemLabel>
              </QItemSection>
            </QItem>
          </QList>
          <QList separator v-if="engineErrorArray.length > 0">
            <div class="error">失敗（エンジンエラー）:</div>
            <QItem v-for="(value, index) in engineErrorArray" :key="index">
              <QItemSection>
                <QItemLabel>{{ value }}</QItemLabel>
              </QItemSection>
            </QItem>
          </QList>
          <QList separator v-if="successArray.length > 0">
            <div class="success">成功:</div>
            <QItem v-for="(value, index) in successArray" :key="index">
              <QItemSection>
                <QItemLabel>{{ value }}</QItemLabel>
              </QItemSection>
            </QItem>
          </QList>
        </QPage>
      </QPageContainer>
      <QFooter>
        <QToolbar>
          <QSpace />
          <QBtn flat dense align="right" @click="close" label="閉じる" />
        </QToolbar>
      </QFooter>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { WriteErrorTypeForSaveAllResultDialog } from "@/store/type";
import { useDialogPluginComponent } from "quasar";

withDefaults(
  defineProps<{
    successArray: (string | undefined)[];
    writeErrorArray: WriteErrorTypeForSaveAllResultDialog[];
    engineErrorArray: (string | undefined)[];
  }>(),
  {
    successArray: () => [],
    writeErrorArray: () => [],
    engineErrorArray: () => [],
  }
);
const { dialogRef, onDialogOK } = useDialogPluginComponent();
const close = () => onDialogOK();
</script>
<style scoped lang="scss">
@use '@/styles/colors' as colors;

.q-page-container {
  margin-top: 1em;
}

.q-item {
  border-bottom: solid 0.1rem colors.$primary;
}

.success {
  color: green;
}
.error {
  color: red;
}
</style>
