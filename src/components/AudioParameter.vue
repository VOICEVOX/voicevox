<template>
  <div
    @mouseenter="valueLabel.visible = true"
    @mouseleave="valueLabel.visible = false"
  >
    <q-badge
      class="value-label"
      text-color="secondary"
      v-if="!disable && (valueLabel.visible || valueLabel.panning)"
    >
      {{ previewValue.currentValue.value.toPrecision(3) }}
    </q-badge>
    <q-slider
      vertical
      reverse
      snap
      :min="min"
      :max="max"
      :step="step"
      :disable="disable || uiLocked"
      :model-value="previewValue.currentValue.value"
      @update:model-value="previewValue.setPreviewValue(parseFloat($event))"
      @change="changeValue(parseFloat($event))"
      @wheel="changeValueByScroll($event.deltaY, $event.ctrlKey)"
      @pan="setPanning"
    />
  </div>
</template>

<script lang="ts">
import { PreviewableValue } from "@/helpers/previewableValue";
import { defineComponent, reactive, onMounted, onUnmounted } from "vue";

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

    function setShiftKeyFlag(event: KeyboardEvent) {
      if (event.shiftKey) shiftKeyFlag = true;
    }

    onMounted(() => {
      window.addEventListener("keyup", handleKeyPress);
      window.addEventListener("keydown", setShiftKeyFlag);
    });

    onUnmounted(() => {
      window.removeEventListener("keyup", handleKeyPress);
      window.removeEventListener("keydown", setShiftKeyFlag);
    });

    const previewValue = new PreviewableValue(() => props.value);

    const changeValue = (newValue: number) => {
      emit(
        "changeValue",
        props.accentPhraseIndex,
        props.moraIndex,
        newValue,
        "pitch"
      );
    };

    const changeValueByScroll = (deltaY: number, withDetailedStep: boolean) => {
      const step = withDetailedStep ? 0.01 : 0.1;
      let newValue = props.value - (deltaY > 0 ? step : -step);
      newValue = Math.round(newValue * 1e2) / 1e2;
      if (!props.uiLocked && !shiftKeyFlag && 6.5 >= newValue && newValue >= 3)
        changeValue(newValue);
    };

    const valueLabel = reactive({
      visible: false,
      // NOTE: q-slider操作中の表示のON/OFFは@panに渡ってくるphaseで判定する
      // SEE: https://github.com/quasarframework/quasar/issues/7739#issuecomment-689664504
      panning: false,
    });

    const setPanning = (panningPhase: string) => {
      if (panningPhase === "start") {
        valueLabel.panning = true;
        previewValue.startPreview();
      } else {
        valueLabel.panning = false;
        previewValue.stopPreview();
      }
    };

    return {
      previewValue,
      changeValue,
      changeValueByScroll,
      valueLabel,
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
