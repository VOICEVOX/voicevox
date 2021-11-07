<template>
  <div
    @mouseenter="handleMouseHover(true)"
    @mouseleave="handleMouseHover(false)"
  >
    <q-badge
      class="value-label"
      color="primary-light"
      text-color="display-dark"
      v-if="
        !disable && (valueLabel.visible || previewSlider.state.isPanning.value)
      "
    >
      {{ previewSlider.state.currentValue.value?.toFixed(precisionComputed) }}
    </q-badge>
    <q-slider
      vertical
      reverse
      snap
      color="primary-light"
      :style="clipPathComputed"
      :min="previewSlider.qSliderProps.min.value"
      :max="previewSlider.qSliderProps.max.value"
      :step="previewSlider.qSliderProps.step.value"
      :disable="previewSlider.qSliderProps.disable.value"
      :model-value="previewSlider.qSliderProps.modelValue.value"
      @update:model-value="previewSlider.qSliderProps['onUpdate:modelValue']"
      @change="previewSlider.qSliderProps.onChange"
      @wheel="previewSlider.qSliderProps.onWheel"
      @pan="previewSlider.qSliderProps.onPan"
    />
  </div>
</template>

<script lang="ts">
import { previewSliderHelper } from "@/helpers/previewSliderHelper";
import { MoraDataType } from "@/type/preload";
import { computed, defineComponent, reactive, ref, watch } from "vue";

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
    type: { type: String as () => MoraDataType, default: "vowel" },
    clip: { type: Boolean, default: false },
    shiftKeyFlag: { type: Boolean, default: false },
  },

  emits: ["changeValue", "mouseOver"],

  setup(props, { emit }) {
    const lastPitch = ref<number>(props.value);

    const changeValue = (newValue: number, type: MoraDataType = props.type) => {
      emit(
        "changeValue",
        props.accentPhraseIndex,
        props.moraIndex,
        newValue,
        type
      );
    };

    const previewSlider = previewSliderHelper({
      modelValue: () => props.value,
      disable: () => props.disable || props.uiLocked,
      onChange: changeValue,
      max: () => props.max,
      min: () => props.min,
      step: () => props.step,
      scrollStep: () => props.step * 10,
      scrollMinStep: () => props.step,
      disableScroll: () => props.shiftKeyFlag,
    });

    const valueLabel = reactive({
      visible: false,
    });

    const clipPathComputed = computed((): string => {
      if (!props.clip) {
        return "";
      } else {
        if (props.type == "vowel") {
          return "clip-path: inset(-50% -50% -50% 50%)";
        } else {
          return "clip-path: inset(-50% 50% -50% -50%)";
        }
      }
    });

    const handleMouseHover = (isOver: boolean) => {
      valueLabel.visible = isOver;
      if (props.type == "consonant" || props.type == "vowel") {
        emit(
          "mouseOver",
          isOver,
          props.type,
          props.accentPhraseIndex,
          props.moraIndex
        );
      }
    };

    const precisionComputed = computed(() => {
      if (props.type == "pause" || props.type == "pitch") {
        return 2;
      } else {
        return 3;
      }
    });

    watch(
      () => props.value,
      (newVal, oldVal) => {
        if (props.type == "pitch" && lastPitch.value != 0) {
          if (newVal != 0) {
            if (oldVal == 0) {
              changeValue(lastPitch.value as number, "voicing");
            } else {
              lastPitch.value = newVal;
            }
          }
        }
      }
    );

    return {
      previewSlider,
      changeValue,
      valueLabel,
      clipPathComputed,
      handleMouseHover,
      precisionComputed,
      lastPitch,
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
