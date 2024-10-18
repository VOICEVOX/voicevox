<template>
  <QDialog ref="dialogRef" v-model="modelValue">
    <QCard class="q-py-sm q-px-md dialog-card">
      <QCardSection>
        <div class="text-h5">テンポ・拍子変更</div>
      </QCardSection>

      <QSeparator />

      <QCardSection>
        <QCardActions>
          <div>テンポ</div>
          <QSpace />
          （テンポ変更）
        </QCardActions>
      </QCardSection>

      <QSeparator />

      <QCardActions>
        <QSpace />
        <QBtn
          unelevated
          align="right"
          label="キャンセル"
          color="toolbar-button"
          textColor="toolbar-button-display"
          class="text-no-wrap text-bold q-mr-sm"
          @click="handleCancel"
        />
        <QBtn
          unelevated
          align="right"
          label="変更する"
          color="primary"
          textColor="display-on-primary"
          class="text-no-wrap text-bold q-mr-sm"
          @click="handleOk"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from "quasar";
import { ref } from "vue";
import BaseCell from "./ExportSongAudioDialog/BaseCell.vue";
import { Tempo, TimeSignature } from "@/store/type";

export type ExportTarget = "master" | "stem";
const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const modelValue = defineModel<boolean>();
const props = defineProps<{
  timeSignatureChange: Omit<TimeSignature, "measureNumber"> | undefined;
  tempoChange: Omit<Tempo, "position"> | undefined;
}>();
defineEmits({
  ...useDialogPluginComponent.emitsObject,
});

const timeSignatureChange = ref(props.timeSignatureChange);
const tempoChange = ref(props.tempoChange);

const handleOk = () => {
  onDialogOK();
};

// キャンセルボタンクリック時
const handleCancel = () => {
  onDialogCancel();
  modelValue.value = false;
};
</script>

<style scoped lang="scss">
.dialog-card {
  width: 700px;
  max-width: 80vw;
}

.scrollable-area {
  overflow-y: auto;
  max-height: calc(100vh - 100px - 295px);
}
</style>
