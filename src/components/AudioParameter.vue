<template>
  <div class="audio-parameter">
    <q-badge
      v-if="shouldDisplayValueLabel"
      class="value-label"
      :class="{
        'value-label-highlighted': isOperating && forceValueLabelVisible,
        'value-label-consonant':
          forceValueLabelVisible && clip && type === 'consonant',
        'value-label-vowel': forceValueLabelVisible && clip && type === 'vowel',
      }"
      :style="{
        'z-index': 100 - moraIndex,
      }"
      color="primary"
      text-color="display-on-primary"
    >
      {{
        previewSlider.state.currentValue.value != undefined
          ? previewSlider.state.currentValue.value.toFixed(precisionComputed)
          : undefined
      }}
    </q-badge>
    <q-slider
      vertical
      reverse
      snap
      color="primary"
      track-size="2.5px"
      :style="clipPathComputed"
      :min="previewSlider.qSliderProps.min.value"
      :max="previewSlider.qSliderProps.max.value"
      :step="previewSlider.qSliderProps.step.value"
      :disable="previewSlider.qSliderProps.disable.value"
      :model-value="previewSlider.qSliderProps.modelValue.value"
      @update:model-value="previewSlider.qSliderProps['onUpdate:modelValue']"
      @click.stop="stopPropagation"
      @change="previewSlider.qSliderProps.onChange"
      @wheel="previewSlider.qSliderProps.onWheel"
      @pan="previewSlider.qSliderProps.onPan"
      @mouseenter="handleMouseHover(true)"
      @mouseleave="handleMouseHover(false)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { previewSliderHelper } from "@/helpers/previewSliderHelper";
import { MoraDataType } from "@/type/preload";

const props = withDefaults(
  defineProps<{
    value: number;
    moraIndex: number;
    uiLocked: boolean;
    min?: number;
    max?: number;
    step?: number;
    disable?: boolean;
    type?: MoraDataType;
    clip?: boolean;
    shiftKeyFlag?: boolean;
    forceValueLabelVisible?: boolean;
  }>(),
  {
    min: 0.0,
    max: 10.0,
    step: 0.01,
    disable: false,
    type: "vowel",
    clip: false,
    shiftKeyFlag: false,
    forceValueLabelVisible: false,
  }
);

const emit =
  defineEmits<{
    (
      e: "changeValue",
      moraIndex: number,
      newValue: number,
      type: MoraDataType
    ): Promise<void>;
    (
      e: "mouseOver",
      isOver: boolean,
      type: MoraDataType,
      moraIndex: number
    ): void;
  }>();

const changeValue = (newValue: number, type: MoraDataType = props.type) =>
  emit("changeValue", props.moraIndex, newValue, type);

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

const isHovered = ref(false);

const handleMouseHover = (isOver: boolean) => {
  isHovered.value = isOver;
  if (props.type == "consonant" || props.type == "vowel") {
    emit("mouseOver", isOver, props.type, props.moraIndex);
  }
};

const isOperating = computed(
  () => isHovered.value || previewSlider.state.isPanning.value
);

defineExpose({
  isOperating,
});

const shouldDisplayValueLabel = computed(
  () =>
    !props.uiLocked &&
    !props.disable &&
    (props.forceValueLabelVisible || isOperating.value)
);

const precisionComputed = computed(() => {
  if (props.type == "pause" || props.type == "pitch") {
    return 2;
  } else {
    return 3;
  }
});

// クリックでアクセント句が選択されないように@click.stopに渡す
const stopPropagation = () => {
  // fn is not a function エラーを回避するために何もしない関数を渡す
};
</script>

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

    // altキー押下中は母音と子音の値ラベルの表示位置が被らないようにずらす
    &.value-label-consonant {
      transform: translateX(-50%) translateX(14px) translateY(-60%);
    }
    &.value-label-vowel {
      transform: translateX(-50%) translateX(16px) translateY(60%);
    }
  }
}

.value-label-highlighted {
  font-weight: bold;
}
</style>
