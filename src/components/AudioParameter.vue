<template>
  <div
    @mouseenter="pitchLabel.visible = true"
    @mouseleave="pitchLabel.visible = false"
  >
    <q-badge
      class="value-label"
      text-color="secondary"
      v-if="!disable && (pitchLabel.visible || pitchLabel.panning)"
    >
      {{ currentValue.toPrecision(3) }}
    </q-badge>
    <q-slider
      vertical
      reverse
      snap
      :min="min"
      :max="max"
      :step="step"
      :disable="disable || uiLocked"
      :model-value="currentValue"
      @update:model-value="changePreviewValue(parseFloat($event))"
      @change="changeValue(parseFloat($event))"
      @wheel="changeValueByScroll($event.deltaY, $event.ctrlKey)"
      @pan="setPanning"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, computed, ref } from "vue";

export default defineComponent({
  name: "AudioParameter",

  props: {
    value: { type: Number, required: true },
    accentPhraseIndex: { type: Number, required: true },
    moraIndex: { type: Number, required: true },
    uiLocked: { type: Boolean, required: true },
    min: { type: Number, default: 0.0 },
    max: { type: Number, default: 10.0 },
    step: { type: Number, default: 0.01 },
    disable: { type: Boolean, default: false },
  },

  emits: ["changeValue"],

  setup(props, { emit }) {
    // detect shift key and set flag, preventing changes in intonation while scrolling around
    let shiftKeyFlag = false;

    function handleKeyPress(event: KeyboardEvent) {
      if (event.key === "Shift") shiftKeyFlag = false;
    }
    window.addEventListener("keyup", handleKeyPress);

    function setShiftKeyFlag(event: KeyboardEvent) {
      if (event.shiftKey) shiftKeyFlag = true;
    }
    window.addEventListener("keydown", setShiftKeyFlag);

    const isPreview = ref(false);
    const previewValue = ref(props.value);

    const currentValue = computed(() =>
      isPreview.value ? previewValue.value : props.value
    );

    const changePreviewValue = (newValue: number) => {
      isPreview.value = true;
      previewValue.value = newValue;
    };

    const changeValue = (newValue: number) => {
      isPreview.value = false;
      emit("changeValue", [props.accentPhraseIndex, props.moraIndex, newValue]);
    };

    const changeValueByScroll = (deltaY: number, withDetailedStep: boolean) => {
      const step = withDetailedStep ? 0.01 : 0.1;
      let newValue = props.value - (deltaY > 0 ? step : -step);
      newValue = Math.round(newValue * 1e2) / 1e2;
      if (!props.uiLocked && !shiftKeyFlag && 6.5 >= newValue && newValue >= 3)
        changeValue(newValue);
    };

    const pitchLabel = reactive({
      visible: false,
      // NOTE: q-slider操作中の表示のON/OFFは@panに渡ってくるphaseで判定する
      // SEE: https://github.com/quasarframework/quasar/issues/7739#issuecomment-689664504
      panning: false,
    });

    const setPanning = (panningPhase: string) => {
      isPreview.value = pitchLabel.panning = panningPhase === "start";
      previewValue.value = props.value;
    };

    return {
      previewValue,
      currentValue,
      changePreviewValue,
      changeValue,
      changeValueByScroll,
      pitchLabel,
      setPanning,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles' as global;

$value-label-height: 24px;

div {
  position: absolute;
  top: 8px;
  bottom: 8px;
  .q-slider {
    height: calc(100% - #{$value-label-height + 12px});
    margin-top: $value-label-height + 12px;
    min-width: 30px;
    max-width: 30px;
    :deep(.q-slider__track-container--v) {
      margin-left: -1.5px;
      width: 3px;
    }
  }
  .value-label {
    height: $value-label-height;
    padding: 0px 8px;
    transform: translateX(-50%) translateX(15px);
  }
}
</style>
