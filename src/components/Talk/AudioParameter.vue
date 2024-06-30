<template>
  <div
    @mouseenter="handleMouseHover(true)"
    @mouseleave="handleMouseHover(false)"
  >
    <QBadge
      v-if="
        !disable && (valueLabel.visible || previewSlider.state.isPanning.value)
      "
      class="value-label"
      color="primary"
      textColor="display-on-primary"
    >
      {{
        previewSlider.state.currentValue.value != undefined
          ? previewSlider.state.currentValue.value.toFixed(precisionComputed)
          : undefined
      }}
    </QBadge>
    <!-- NOTE: QTooltipをQSlider内にしたいがquasarが未対応っぽいので兄弟に -->
    <QTooltip
      v-if="previewSlider.qSliderProps.disable.value"
      :delay="500"
      transitionShow="jump-up"
      transitionHide="jump-down"
      anchor="top middle"
      self="center middle"
      >無声化した音にイントネーションは存在しません。<br />テキストをクリックすることで無声化を解けます。</QTooltip
    >
    <QSlider
      vertical
      reverse
      snap
      color="primary"
      trackSize="2.5px"
      :style="clipPathComputed"
      :min="previewSlider.qSliderProps.min.value"
      :max="previewSlider.qSliderProps.max.value"
      :step="previewSlider.qSliderProps.step.value"
      :disable="previewSlider.qSliderProps.disable.value"
      :modelValue="previewSlider.qSliderProps.modelValue.value"
      @update:modelValue="previewSlider.qSliderProps['onUpdate:modelValue']"
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
  }>(),
  {
    min: 0.0,
    max: 10.0,
    step: 0.01,
    disable: false,
    type: "vowel",
    clip: false,
    shiftKeyFlag: false,
  },
);

const emit = defineEmits<{
  (
    e: "changeValue",
    moraIndex: number,
    newValue: number,
    type: MoraDataType,
  ): Promise<void>;
  (
    e: "mouseOver",
    isOver: boolean,
    type: MoraDataType,
    moraIndex: number,
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
  }
}
</style>
