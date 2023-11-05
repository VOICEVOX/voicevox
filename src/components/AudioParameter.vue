<template>
  <div
    @mouseenter="handleMouseHover(true)"
    @mouseleave="handleMouseHover(false)"
  >
    <div>
      <q-input
        v-if="!disable"
        dense
        borderless
        :model-value="
          previewSlider.qSliderProps.modelValue.value
            ? previewSlider.qSliderProps.modelValue.value.toFixed(2)
            : previewSlider.qSliderProps.min.value
        "
        :style="{
          width: '25px',
          height: '20px',
          'font-size': 'x-small',
          position: 'relative',
          top: `${verticalOffset}px`,
        }"
        @change="changeValue"
      >
      </q-input>
    </div>
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
    />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
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
    verticalOffset: number;
  }>(),
  {
    min: 0.0,
    max: 10.0,
    step: 0.01,
    disable: false,
    type: "vowel",
    clip: false,
    shiftKeyFlag: false,
    verticalOffset: 0,
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

const changeValue = (newValue: number, type: MoraDataType = props.type) => {
  newValue = formatValue(newValue, props.min, props.max);
  return emit("changeValue", props.moraIndex, newValue, type);
};
// 参考用
// const changeValue = (newValue: number, type: MoraDataType = props.type) =>
//   emit("changeValue", props.moraIndex, newValue, type);

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
    emit("mouseOver", isOver, props.type, props.moraIndex);
  }
};

const formatValue = (
  value: number | null,
  defaultMinValue: number,
  defaultMaxValue: number
): number => {
  if (typeof value === "number") {
    return parseFloat(value.toFixed(2));
  }

  if (value === null) {
    return parseFloat(defaultMinValue.toFixed(2));
  }

  const tmp = Number(value);
  if (Number.isNaN(tmp)) {
    return parseFloat(defaultMinValue.toFixed(2));
  }

  if (tmp <= defaultMinValue) {
    return parseFloat(defaultMinValue.toFixed(2));
  }
  if (defaultMaxValue <= tmp) {
    return parseFloat(defaultMaxValue.toFixed(2));
  }

  return parseFloat(tmp.toFixed(2));
};

// クリックでアクセント句が選択されないように@click.stopに渡す
const stopPropagation = () => {
  // fn is not a function エラーを回避するために何もしない関数を渡す
};
</script>

<style scoped lang="scss">
$value-label-height: 24px;

div {
  position: absolute;
  top: 0px;
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
