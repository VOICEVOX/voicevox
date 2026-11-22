<template>
  <SliderRoot
    class="song-slider"
    :min
    :max
    :step
    :disabled
    thumbAlignment="overflow"
    :style="{ '--value': valueRatio }"
    :modelValue="[modelValue]"
    @update:modelValue="
      (value) => {
        if (value == undefined) {
          throw new Error('Undefined value received');
        }
        $emit('update:modelValue', value[0]);
      }
    "
    @wheel="onWheel"
    @valueCommit="commitValue($event[0])"
    @pointerdown="onPointerDown"
    @pointerup="dragging = false"
    @lostpointercapture="dragging = false"
  >
    <SliderTrack class="track">
      <SliderRange class="range" />
    </SliderTrack>
    <!-- ツールチップはドラッグについていくよう、表示中は毎フレーム位置を計算し直す -->
    <SongTooltip
      :label="formatValue(modelValue)"
      :open="dragging"
      side="top"
      updatePositionStrategy="always"
    >
      <SliderThumb
        class="thumb"
        :aria-label="label"
        :aria-valuetext="formatValue(modelValue)"
      />
    </SongTooltip>
  </SliderRoot>
</template>

<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from "reka-ui";
import { computed, onBeforeUnmount, ref } from "vue";
import SongTooltip from "./SongTooltip.vue";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";

// のちのち統合する可能性があるため、BaseSliderと共通のpropsとイベントは揃える
const props = withDefaults(
  defineProps<{
    label: string;
    min?: number;
    max?: number;
    step?: number;
    scrollStep?: number;
    disabled?: boolean;
    modelValue: number;
    /** ドラッグ中に表示するツールチップ内テキスト */
    formatValue?: (value: number) => string;
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
    scrollStep: undefined,
    formatValue: (value: number) => String(value),
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: number];
  valueCommit: [value: number];
}>();

const valueRatio = computed(
  () => (props.modelValue - props.min) / (props.max - props.min),
);

const dragging = ref(false);
const onPointerDown = () => {
  if (props.disabled) return;
  dragging.value = true;
};

// ホイールは回すたびに確定するとアンドゥなど履歴が細かく増えるので、回したあと一定時間待ってまとめて1回確定する
const WHEEL_COMMIT_DELAY_MS = 300;
let pendingWheelCommit:
  { value: number; timer: ReturnType<typeof setTimeout> } | undefined;

const commitValue = (value: number) => {
  if (pendingWheelCommit != undefined) {
    clearTimeout(pendingWheelCommit.timer);
    pendingWheelCommit = undefined;
  }
  emit("valueCommit", value);
};

const commitValueLater = (value: number) => {
  if (pendingWheelCommit != undefined) {
    clearTimeout(pendingWheelCommit.timer);
  }
  pendingWheelCommit = {
    value,
    timer: setTimeout(() => commitValue(value), WHEEL_COMMIT_DELAY_MS),
  };
};

onBeforeUnmount(() => {
  if (pendingWheelCommit != undefined) {
    commitValue(pendingWheelCommit.value);
  }
});

const onWheel = (event: WheelEvent) => {
  if (props.disabled) return;
  // 横だけのスクロールでは値を変えず、ページの横スクロールに任せる
  if (event.deltaY === 0) return;
  event.preventDefault();

  const delta = event.deltaY > 0 ? -1 : 1;
  const scrollStep =
    props.scrollStep != undefined && !isOnCommandOrCtrlKeyDown(event)
      ? props.scrollStep
      : props.step;

  const value = props.modelValue + scrollStep * delta;
  const clampedValue = Math.min(props.max, Math.max(props.min, value));

  emit("update:modelValue", clampedValue);
  commitValueLater(clampedValue);
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/song-mixin" as song-mixin;

$track-height: 2px;
$thumb-size: 10px;
$thumb-gap: 1.5px;

.song-slider {
  position: relative;
  margin-inline: calc($thumb-size / 2);
  display: flex;
  align-items: center;
  height: 16px;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  @include song-mixin.disabled;
}

.track {
  position: relative;
  flex-grow: 1;
  height: $track-height;
  border-radius: calc($track-height / 2);
  background: var(--scheme-color-surface-variant);
  // どの背景の上でもつまみが線から浮いて見えるよう、つまみの周りだけ線を描かない
  mask: radial-gradient(
    circle at calc(var(--value) * 100%) 50%,
    transparent calc($thumb-size / 2 + $thumb-gap),
    #000 calc($thumb-size / 2 + $thumb-gap)
  );
}

.range {
  position: absolute;
  height: 100%;
  border-radius: inherit;
  background: var(--scheme-color-outline);
}

.thumb {
  display: block;
  width: $thumb-size;
  height: $thumb-size;
  border-radius: 50%;
  background: var(--scheme-color-outline);

  @include song-mixin.focus-ring;

  &:focus-visible {
    outline-offset: 2px;
  }
}
</style>
