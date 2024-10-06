<template>
  <QDialog ref="dialogRef" v-model="modelValue" @beforeShow="initializeValues">
    <QCard class="q-py-sm q-px-md dialog-card">
      <QCardSection>
        <div class="text-h5">書き出し</div>
      </QCardSection>

      <QSeparator />

      <QCardSection>
        <BaseCell
          v-model="audioFormat"
          title="フォーマット"
          description="書き出す音声ファイルのフォーマットを選択します。"
        >
          <QBtnToggle
            v-model="audioFormat"
            :options="supportedFormats"
            padding="xs md"
            unelevated
            color="surface"
            textColor="display"
            toggleColor="primary"
            toggleTextColor="display-on-primary"
            dense
          />
        </BaseCell>
        <BaseCell
          title="音声のサンプリングレート"
          description="再生と保存時の音声のサンプリングレートを変更できます（サンプリングレートを上げても音声の品質は上がりません）。"
          transparent
        >
          <QSelect
            v-model="samplingRate"
            dense
            name="samplingRate"
            :options="samplingRateOptions"
            :optionLabel="renderSamplingRateLabel"
          >
          </QSelect>
        </BaseCell>
        <BaseCell
          v-model="withLimiter"
          title="リミッターを適用する"
          description="書き出し時の音量を制限します。"
        >
          <QToggle v-model="withLimiter" />
        </BaseCell>
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
          label="書き出し"
          color="toolbar-button"
          textColor="toolbar-button-display"
          class="text-no-wrap text-bold q-mr-sm"
          @click="handleExportTrack"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import BaseCell from "./BaseCell.vue";
import { SupportedAudioFormat } from "@/sing/domain";

export type ExportAudioSetting = {
  sampleRate: number;
  audioFormat: SupportedAudioFormat;
  withLimiter: boolean;
};

const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const modelValue = defineModel<boolean>();
const emit = defineEmits<{
  /** 音声をエクスポートするときに呼ばれる */
  exportAudio: [setting: ExportAudioSetting];
}>();

// フォーマット選択
const audioFormat = ref<SupportedAudioFormat>("wav");
const supportedFormats = [
  {
    label: "WAV",
    value: "wav",
  },
  {
    label: "mp3",
    value: "mp3",
  },
  {
    label: "ogg",
    value: "ogg",
  },
];

// サンプルレート
const samplingRate = ref<number>(48000);
const samplingRateOptions = [24000, 44100, 48000, 88200, 96000];
const renderSamplingRateLabel = (rate: number) => `${rate} Hz`;

// リミッター
const withLimiter = ref<boolean>(true);

const initializeValues = () => {
  audioFormat.value = "wav";
  samplingRate.value = 48000;
  withLimiter.value = true;
};

const handleExportTrack = () => {
  onDialogOK();
  emit("exportAudio", {
    sampleRate: samplingRate.value,
    audioFormat: audioFormat.value,
    withLimiter: withLimiter.value,
  });
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
