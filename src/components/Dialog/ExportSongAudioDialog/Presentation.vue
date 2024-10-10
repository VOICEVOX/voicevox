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
        <BaseCell
          title="音声をステレオ化"
          description="ONの場合、音声データがモノラルからステレオに変換されてから保存が行われます。"
        >
          <QToggle v-model="isStereo" />
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
          title="リミッターを適用する"
          description="ONの場合、0dBを極力超えないように音声を調整します。"
        >
          <QToggle v-model="withLimiter" />
        </BaseCell>
        <BaseCell
          title="適用するトラックのパラメーター"
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
import { SongExportSetting } from "@/store/type";
import { TrackParameters } from "@/store/singing";

export type ExportTarget = "master" | "stem";
const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const modelValue = defineModel<boolean>();
const emit = defineEmits<{
  /** 音声をエクスポートするときに呼ばれる */
  exportAudio: [exportTarget: ExportTarget, setting: SongExportSetting];
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

// ステレオ
const isStereo = ref<boolean>(true);

// サンプルレート
const samplingRate = ref<number>(48000);
const samplingRateOptions = [24000, 44100, 48000, 88200, 96000];
const renderSamplingRateLabel = (rate: number) => `${rate} Hz`;

// リミッター
const withLimiter = ref<boolean>(true);

// パン・ボリューム・ミュート
const withTrackParameters = ref<(keyof TrackParameters)[]>([
  "pan",
  "gain",
  "soloAndMute",
]);
const trackParameterOptions = computed(() => [
  {
    label: "パン",
    value: "pan",
    disable: !isStereo.value,
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
    isStereo: isStereo.value,
    sampleRate: samplingRate.value,
    withLimiter: withLimiter.value,
    withTrackParameters: {
      pan: withTrackParameters.value.includes("pan") && isStereo.value,
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
