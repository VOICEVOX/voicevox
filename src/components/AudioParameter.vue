<script setup lang="ts">
import { previewSliderHelper } from "@/helpers/previewSliderHelper";
import { MoraDataType } from "@/type/preload";
import { computed, reactive } from "vue";

const props =
  defineProps<{
    value: number;
    accentPhraseIndex: number;
    moraIndex: number;
    uiLocked: boolean;
    min: number;
    max: number;
    step: number;
    disable: boolean;
    type: MoraDataType;
    clip: boolean;
    shiftKeyFlag: boolean;
  }>();

const emit =
  defineEmits<{
    (
      e: "changeValue",
      accentPhraseIndex: number,
      moraIndex: number,
      newValue: number,
      type: MoraDataType
    ): void;
    (
      e: "mouseOver",
      isOver: boolean,
      accentPhraseIndex: number,
      moraIndex: number,
      type: MoraDataType
    ): void;
  }>();

const changeValue = (newValue: number, type: MoraDataType = props.type) => {
  emit("changeValue", props.accentPhraseIndex, props.moraIndex, newValue, type);
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
  disableScroll: () => props.shiftKeyFlag, // shift+ホイール操作の横方向スクロール中にスライダー操作を無視するため
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
      props.accentPhraseIndex,
      props.moraIndex,
      props.type
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
</script>

<template>
  <div
    @mouseenter="handleMouseHover(true)"
    @mouseleave="handleMouseHover(false)"
  >
    <QBadge
      class="value-label"
      color="primary-light"
      text-color="display-on-primary"
      v-if="
        !disable && (valueLabel.visible || previewSlider.state.isPanning.value)
      "
    >
      {{
        previewSlider.state.currentValue.value
          ? previewSlider.state.currentValue.value.toFixed(precisionComputed)
          : undefined
      }}
    </QBadge>
    <QSlider
      vertical
      reverse
      snap
      color="primary-light"
      trackSize="2.5px"
      :style="clipPathComputed"
      :min="previewSlider.qSliderProps.min.value"
      :max="previewSlider.qSliderProps.max.value"
      :step="previewSlider.qSliderProps.step.value"
      :disable="previewSlider.qSliderProps.disable.value"
      :model-value="previewSlider.qSliderProps.modelValue.value"
      @update:model-value="previewSlider.qSliderProps['onUpdate:modelValue']"
      @click.stop="
        undefined; // クリックでアクセント句が選択されないように
      "
      @change="previewSlider.qSliderProps.onChange"
      @wheel="previewSlider.qSliderProps.onWheel"
      @pan="previewSlider.qSliderProps.onPan"
    />
  </div>
</template>
<style scoped lang="scss">
$value-label-height: 24px;

div {
  position: absolute;
  top: 8px;
  bottom: 8px;
  .q-slider {
    height: calc(100% - #{$value-label-height + 12px});
    margin-top: $value-label-height + 12px;
    min-width: 20px;
    max-width: 20px;
    :deep(.q-slider__track-container--v) {
      margin-left: -3.5px;
    }
  }
  .value-label {
    height: $value-label-height;
    padding: 0px 8px;
    transform: translateX(-50%) translateX(15px);
  }
}
</style>
