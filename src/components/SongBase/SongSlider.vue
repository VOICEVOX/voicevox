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
    @valueCommit="$emit('valueCommit', $event[0])"
  >
    <SliderTrack class="track">
      <SliderRange class="range" />
    </SliderTrack>
    <SliderThumb class="thumb" :aria-label="label" />
  </SliderRoot>
</template>

<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from "reka-ui";
import { computed } from "vue";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";
import { debounce } from "@/helpers/timer";

// のちのち統合する可能性があるため、BaseSliderと共通のpropsとイベントは揃える
const props = withDefaults(
  defineProps<{
    /** つまみのaria-labelにする */
    label: string;
    min?: number;
    max?: number;
    step?: number;
    scrollStep?: number;
    disabled?: boolean;
    modelValue: number;
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
    scrollStep: undefined,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: number];
  valueCommit: [value: number];
}>();

const valueRatio = computed(
  () => (props.modelValue - props.min) / (props.max - props.min),
);

const debounceEmitValueCommit = debounce(
  (value: number) => emit("valueCommit", value),
  300,
);

const onWheel = (event: WheelEvent) => {
  if (props.disabled) return;
  event.preventDefault();

  const delta = event.deltaY > 0 ? -1 : 1;
  const scrollStep =
    props.scrollStep != undefined && !isOnCommandOrCtrlKeyDown(event)
      ? props.scrollStep
      : props.step;

  const value = props.modelValue + scrollStep * delta;
  const clampedValue = Math.min(props.max, Math.max(props.min, value));

  emit("update:modelValue", clampedValue);
  debounceEmitValueCommit(clampedValue);
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

  // つまみが小さいので、枠を外側に描いて見えるようにする
  &:focus-visible {
    outline-offset: 2px;
  }
}
</style>
