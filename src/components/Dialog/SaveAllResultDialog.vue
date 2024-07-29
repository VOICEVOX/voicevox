<template>
  <QDialog ref="dialogRef" persistent>
    <QLayout container view="hhh lpr fFf" class="q-dialog-plugin bg-background">
      <QPageContainer class="q-px-md">
        <h5 class="text-h5 q-my-md">音声書き出し結果</h5>
        <QList separator bordered class="rounded-borders">
          <QExpansionItem
            v-if="props.writeErrorArray.length > 0"
            :label="`${props.writeErrorArray.length}件の書き込みエラーによる失敗`"
            bordered
            headerClass="text-warning text-bold"
            icon="warning"
          >
            <QItem v-for="(value, index) in props.writeErrorArray" :key="index">
              <QItemSection>
                <QItemLabel>{{ value.path }}</QItemLabel>
                <QItemLabel>詳細：{{ value.message }}</QItemLabel>
              </QItemSection>
            </QItem>
          </QExpansionItem>
          <QExpansionItem
            v-if="props.engineErrorArray.length > 0"
            :label="`${props.engineErrorArray.length}件のエンジンエラーによる失敗`"
            bordered
            headerClass="text-warning text-bold"
            icon="warning"
          >
            <QItem
              v-for="(value, index) in props.engineErrorArray"
              :key="index"
            >
              <QItemSection>
                <QItemLabel>{{ value.path }}</QItemLabel>
                <QItemLabel v-if="value.message"
                  >詳細：{{ value.message }}</QItemLabel
                >
              </QItemSection>
            </QItem>
          </QExpansionItem>
          <QExpansionItem
            :label="`${props.successArray.length}件の成功`"
            bordered
            icon="check"
            headerClass="text-bold"
          >
            <QList v-if="props.successArray.length > 0" separator>
              <QItem v-for="(value, index) in props.successArray" :key="index">
                <QItemSection>
                  <QItemLabel>{{ value }}</QItemLabel>
                </QItemSection>
              </QItem>
            </QList>
          </QExpansionItem>
        </QList>
      </QPageContainer>
      <QFooter>
        <QToolbar>
          <QSpace />
          <QBtn
            unelevated
            align="right"
            label="閉じる"
            color="toolbar-button"
            textColor="toolbar-button-display"
            class="text-no-wrap text-bold q-mr-sm"
            @click="close"
          />
        </QToolbar>
      </QFooter>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from "quasar";
import { ErrorTypeForSaveAllResultDialog } from "@/store/type";

const props = defineProps<{
  successArray: string | undefined[];
  writeErrorArray: ErrorTypeForSaveAllResultDialog[];
  engineErrorArray: ErrorTypeForSaveAllResultDialog[];
}>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const close = () => onDialogOK();
</script>
