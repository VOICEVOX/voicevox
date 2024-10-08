<template>
  <QDialog ref="dialogRef" v-model="modelValue">
    <QCard class="q-py-sm q-px-md dialog-card">
      <QCardSection>
        <div class="text-h5">書き出し</div>
      </QCardSection>

      <QSeparator />

      <QCardSection>
        <BaseCell
          title="書き出し対象"
          description="すべてのトラックをまとめて書き出すか、トラックごとに書き出すか選べます。"
        >
          <QBtnToggle
            v-model="exportTarget"
            :options="exportTargets"
            padding="xs md"
            unelevated
            color="surface"
            textColor="display"
            toggleColor="primary"
            toggleTextColor="display-on-primary"
            dense
          />
        </BaseCell>
        <!-- TODO：実装する
        <BaseCell
          title="フォーマット"
          description="書き出す音声ファイルのフォーマットを選べます。"
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
        </BaseCell> -->
        <BaseCell
          title="音声のサンプリングレート"
          description="音声のサンプリングレートを変更できます。"
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
          title="リミッターを適用する"
          description="ONの場合、音量が制限されます。"
        >
          <QToggle v-model="withLimiter" />
        </BaseCell>
        <BaseCell
          title="トラックのパラメーターを適用する"
          description="OFFの場合、VOICEVOX内のパン、ボリューム、ミュート設定が適用されません。"
        >
          <QToggle v-model="withTrackParameters" />
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
// メモ：前回の設定を引き継ぐため、他のダイアログでやっているようなinitializeValuesはやらない
import { ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import BaseCell from "./BaseCell.vue";
import { SupportedAudioFormat } from "@/sing/domain";

export type ExportTarget = "master" | "stem";
export type ExportAudioSetting = {
  target: ExportTarget;
  sampleRate: number;
  audioFormat: SupportedAudioFormat;
  withLimiter: boolean;
  withTrackParameters: boolean;
};

const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const modelValue = defineModel<boolean>();
const emit = defineEmits<{
  /** 音声をエクスポートするときに呼ばれる */
  exportAudio: [setting: ExportAudioSetting];
}>();

// 書き出し対象選択
const exportTargets = [
  {
    label: "すべてのトラック",
    value: "master",
  },
  {
    label: "トラックごと",
    value: "stem",
  },
];
const exportTarget = ref<ExportTarget>("master");

// フォーマット選択
const audioFormat = ref<SupportedAudioFormat>("wav");
// const supportedFormats = [
//   {
//     label: "WAV",
//     value: "wav",
//   },
//   {
//     label: "mp3",
//     value: "mp3",
//   },
//   {
//     label: "ogg",
//     value: "ogg",
//   },
// ];

// サンプルレート
const samplingRate = ref<number>(48000);
const samplingRateOptions = [24000, 44100, 48000, 88200, 96000];
const renderSamplingRateLabel = (rate: number) => `${rate} Hz`;

// リミッター
const withLimiter = ref<boolean>(true);

// パン・ボリューム・ミュート
const withTrackParameters = ref<boolean>(true);

const handleExportTrack = () => {
  onDialogOK();
  emit("exportAudio", {
    target: exportTarget.value,
    sampleRate: samplingRate.value,
    audioFormat: audioFormat.value,
    withLimiter: withLimiter.value,
    withTrackParameters: withTrackParameters.value,
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
