<template>
  <QDialog ref="dialogRef" v-model="modelValue">
    <QCard class="q-py-sm q-px-md dialog-card">
      <QCardSection>
        <div class="text-h5">音声書き出し</div>
      </QCardSection>

      <QSeparator />

      <QCardSection>
        <BaseCell
          title="書き出し方法"
          description="すべてのトラックをまとめて１つの音声ファイルを書き出すか、トラックごとに音声ファイルを書き出すか選べます。"
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
        <BaseCell
          title="モノラルで書き出し"
          description="ONの場合、パンが無効化され、1つのチャンネルにまとめられて書き出されます。"
        >
          <QToggle v-model="isMono" />
        </BaseCell>
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
          title="音量を制限する"
          description="ONの場合、音量が0dBを極力超えないように音声を調整します。"
        >
          <QToggle v-model="withLimiter" />
        </BaseCell>
        <BaseCell
          title="適用するトラックパラメーター"
          description="パン、ボリューム、ミュートのうち、どのパラメーターを書き出し時に適用するか選べます。"
        >
          <QOptionGroup
            v-model="withTrackParameters"
            type="checkbox"
            inline
            :options="trackParameterOptions"
          />
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
          label="書き出す"
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
// NOTE: 前回の設定を引き継ぐため、他のダイアログでやっているようなinitializeValuesはやらない
import { ref, computed } from "vue";
import { useDialogPluginComponent } from "quasar";
import BaseCell from "./BaseCell.vue";
import { SongExportSetting, TrackParameters } from "@/store/type";

export type ExportTarget = "master" | "stem";
const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const modelValue = defineModel<boolean>();
const emit = defineEmits<{
  /** 音声をエクスポートするときに呼ばれる */
  exportAudio: [exportTarget: ExportTarget, setting: SongExportSetting];
}>();

// 書き出し方法選択
const exportTargets = [
  {
    label: "まとめる（ミックス）",
    value: "master",
  },
  {
    label: "トラック別",
    value: "stem",
  },
];
const exportTarget = ref<ExportTarget>("master");

// モノラル
const isMono = ref<boolean>(false);

// サンプルレート
const samplingRate = ref<number>(48000);
const samplingRateOptions = [24000, 44100, 48000, 88200, 96000];
const renderSamplingRateLabel = (rate: number) => `${rate} Hz`;

// リミッター
const withLimiter = ref<boolean>(true);

// パン・ボリューム・ミュート
const withTrackParametersInner = ref<(keyof TrackParameters)[]>([
  "pan",
  "gain",
  "soloAndMute",
]);
const withTrackParameters = computed({
  get: () =>
    isMono.value
      ? withTrackParametersInner.value.filter((v) => v !== "pan")
      : withTrackParametersInner.value,
  set: (value: (keyof TrackParameters)[]) => {
    withTrackParametersInner.value = value;
  },
});
const trackParameterOptions = computed(() => [
  {
    label: "パン",
    value: "pan",
    disable: isMono.value,
  },
  {
    label: "ボリューム",
    value: "gain",
  },
  {
    label: "ソロ・ミュート",
    value: "soloAndMute",
  },
]);

const handleExportTrack = () => {
  onDialogOK();
  emit("exportAudio", exportTarget.value, {
    isMono: isMono.value,
    sampleRate: samplingRate.value,
    withLimiter: withLimiter.value,
    withTrackParameters: {
      pan: withTrackParameters.value.includes("pan"),
      gain: withTrackParameters.value.includes("gain"),
      soloAndMute: withTrackParameters.value.includes("soloAndMute"),
    },
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
