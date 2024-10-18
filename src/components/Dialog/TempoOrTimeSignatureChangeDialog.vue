<template>
  <QDialog ref="dialogRef" v-model="modelValue">
    <QCard class="q-py-sm q-px-md dialog-card">
      <QCardSection>
        <div class="text-h5">
          {{ props.mode === "edit" ? "BPM・拍子の編集" : "BPM・拍子の追加" }}
        </div>
      </QCardSection>

      <QSeparator />

      <QCardSection>
        <QCardActions>
          <div>BPM</div>
          <QSpace />
          <QInput
            v-model.number="tempoChange.bpm"
            type="number"
            :disable="!tempoChangeEnabled"
            dense
            hideBottomSpace
            class="value-input"
            aria-label="BPM"
          />
          <QToggle
            v-model="tempoChangeEnabled"
            aria-label="BPM変更の有無"
            :disable="!props.canDeleteTempo"
          />
        </QCardActions>
        <QCardActions>
          <div>拍子</div>
          <QSpace />
          <QSelect
            v-model="timeSignatureChange.beats"
            :options="beatsOptions"
            :disable="!timeSignatureChangeEnabled"
            mapOptions
            emitValue
            dense
            userInputs
            optionsDense
            transitionShow="none"
            transitionHide="none"
            class="value-input"
            aria-label="拍子の分子"
          />
          <div
            class="q-px-sm"
            :class="{ disabled: !timeSignatureChangeEnabled }"
          >
            /
          </div>
          <QSelect
            v-model="timeSignatureChange.beatType"
            :options="beatTypeOptions"
            :disable="!timeSignatureChangeEnabled"
            mapOptions
            emitValue
            dense
            userInputs
            optionsDense
            transitionShow="none"
            transitionHide="none"
            class="value-input"
            aria-label="拍子の分母"
          />
          <QToggle
            v-model="timeSignatureChangeEnabled"
            aria-label="拍子変更の有無"
            :disable="!props.canDeleteTimeSignature"
          />
        </QCardActions>
      </QCardSection>

      <QSeparator />

      <QCardActions>
        <QSpace />
        <QBtn
          unelevated
          label="キャンセル"
          color="toolbar-button"
          textColor="toolbar-button-display"
          class="text-no-wrap text-bold q-mr-sm"
          @click="handleCancel"
        />
        <QBtn
          unelevated
          :label="okText"
          :disable="!canOk"
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
import { QInput, useDialogPluginComponent } from "quasar";
import { computed, ref } from "vue";
import { Tempo, TimeSignature } from "@/store/type";
import {
  BEAT_TYPES,
  DEFAULT_BEATS,
  DEFAULT_BEAT_TYPE,
  DEFAULT_BPM,
} from "@/sing/domain";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";

export type TempoOrTimeSignatureChangeDialogResult = {
  timeSignatureChange: Omit<TimeSignature, "measureNumber"> | undefined;
  tempoChange: Omit<Tempo, "position"> | undefined;
};

const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const modelValue = defineModel<boolean>();
const props = defineProps<{
  timeSignatureChange: Omit<TimeSignature, "measureNumber"> | undefined;
  tempoChange: Omit<Tempo, "position"> | undefined;

  canDeleteTimeSignature: boolean;
  canDeleteTempo: boolean;
  mode: "add" | "edit";
}>();
defineEmits({
  ...useDialogPluginComponent.emitsObject,
});

const timeSignatureChangeEnabled = ref(props.timeSignatureChange != undefined);
const timeSignatureChange = ref(
  cloneWithUnwrapProxy(props.timeSignatureChange) || {
    beats: DEFAULT_BEATS,
    beatType: DEFAULT_BEAT_TYPE,
  },
);
const tempoChangeEnabled = ref(props.tempoChange != undefined);
const tempoChange = ref(
  cloneWithUnwrapProxy(props.tempoChange) || {
    bpm: DEFAULT_BPM,
  },
);

const beatsOptions = computed(() => {
  return Array.from({ length: 32 }, (_, i) => ({
    label: (i + 1).toString(),
    value: i + 1,
  }));
});

const beatTypeOptions = BEAT_TYPES.map((beatType) => ({
  label: beatType.toString(),
  value: beatType,
}));

const willChangeExist = computed(
  () => timeSignatureChangeEnabled.value || tempoChangeEnabled.value,
);
const okText = computed(() => {
  if (props.mode === "edit" && willChangeExist.value) {
    return "変更する";
  } else if (props.mode === "edit" && !willChangeExist.value) {
    return "削除する";
  } else {
    return "追加する";
  }
});
const canOk = computed(() => {
  if (props.mode === "edit") {
    if (
      (!props.canDeleteTimeSignature && !timeSignatureChangeEnabled.value) ||
      (!props.canDeleteTempo && !tempoChangeEnabled.value)
    ) {
      // 変更：削除できない場合
      return false;
    }
    // 変更：既存のものと異なるものが入力されているか

    // 拍子・BPMの存在が切り替わる場合
    if (
      (props.timeSignatureChange != undefined) !=
        timeSignatureChangeEnabled.value ||
      (props.tempoChange != undefined) != tempoChangeEnabled.value
    ) {
      return true;
    }

    // 拍子の値が変わる場合
    if (
      props.timeSignatureChange != undefined &&
      (props.timeSignatureChange.beats != timeSignatureChange.value.beats ||
        props.timeSignatureChange.beatType !=
          timeSignatureChange.value.beatType)
    ) {
      return true;
    }

    // BPMの値が変わる場合
    if (
      props.tempoChange != undefined &&
      props.tempoChange.bpm != tempoChange.value.bpm
    ) {
      return true;
    }

    return false;
  } else {
    // 追加：どちらかが入力されているか
    return willChangeExist.value;
  }
});

const handleOk = () => {
  onDialogOK({
    timeSignatureChange: timeSignatureChangeEnabled.value
      ? timeSignatureChange.value
      : undefined,
    tempoChange: tempoChangeEnabled.value ? tempoChange.value : undefined,
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

.value-input {
  width: 60px;
}
</style>
