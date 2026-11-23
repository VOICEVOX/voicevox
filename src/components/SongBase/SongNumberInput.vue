<template>
  <div class="song-number-input" :class="{ flat }">
    <input
      ref="input"
      type="number"
      class="input"
      :aria-label="label"
      :value="modelValue"
      :min
      :max
      :step
      :disabled
      @change="commit"
    />
    <SongIconButton
      icon="remove"
      :label="`${label}を減らす`"
      size="small"
      :disabled="disabled || (min != undefined && modelValue <= min)"
      @pointerdown="startPressing($event, -1)"
      @pointerup="endPressing"
      @pointerleave="endPressing"
      @pointercancel="endPressing"
      @click="onClick($event, -1)"
    />
    <SongIconButton
      icon="add"
      :label="`${label}を増やす`"
      size="small"
      :disabled="disabled || (max != undefined && modelValue >= max)"
      @pointerdown="startPressing($event, 1)"
      @pointerup="endPressing"
      @pointerleave="endPressing"
      @pointercancel="endPressing"
      @click="onClick($event, 1)"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, useTemplateRef } from "vue";
import SongIconButton from "./SongIconButton.vue";

const props = withDefaults(
  defineProps<{
    modelValue: number;
    label: string;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    flat?: boolean;
  }>(),
  {
    min: undefined,
    max: undefined,
    step: 1,
    disabled: false,
    flat: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

const inputElement = useTemplateRef<HTMLInputElement>("input");

// ブラウザのinput:numberと同じ操作感にする
// changeのタイミングはEnterキー・フォーカスを外したとき・矢印キー・増減ボタンを離した時
// 増減ボタンは、押し続けるとmax/minまで増減可能で、離したらchange

const getInput = () => {
  const input = inputElement.value;
  if (input == undefined) {
    throw new Error("input element is not mounted");
  }
  return input;
};

const commit = () => {
  const input = getInput();
  const value = Math.min(
    props.max ?? Infinity,
    Math.max(props.min ?? -Infinity, input.valueAsNumber),
  );
  if (!Number.isNaN(value) && value !== props.modelValue) {
    emit("update:modelValue", value);
  }
  input.value = String(props.modelValue);
};

const stepBy = (direction: 1 | -1) => {
  const input = getInput();
  const before = input.value;
  if (direction === 1) {
    input.stepUp();
  } else {
    input.stepDown();
  }
  return input.value !== before;
};

const REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 60;
let repeatTimer: ReturnType<typeof setTimeout> | undefined;
let pressing = false;

const startPressing = (event: PointerEvent, direction: 1 | -1) => {
  if (event.button !== 0) return;
  pressing = true;
  const repeat = (delay: number) => {
    repeatTimer = setTimeout(() => {
      if (stepBy(direction)) {
        repeat(REPEAT_INTERVAL_MS);
      }
    }, delay);
  };
  if (stepBy(direction)) {
    repeat(REPEAT_DELAY_MS);
  }
};

const endPressing = () => {
  if (!pressing) return;
  pressing = false;
  clearTimeout(repeatTimer);
  repeatTimer = undefined;
  commit();
};

const onClick = (event: MouseEvent, direction: 1 | -1) => {
  if (event.detail === 0) {
    stepBy(direction);
    commit();
  }
};

onBeforeUnmount(() => {
  clearTimeout(repeatTimer);
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/song-variables" as song-vars;
@use "@/styles/v2/song-mixin" as song-mixin;

.song-number-input {
  display: flex;
  align-items: center;
  gap: song-vars.$space-2;
  height: song-vars.$size-control;
}

.input {
  field-sizing: content;
  flex-grow: 1;
  min-width: 2ch;
  height: 100%;
  padding: 0 song-vars.$space-6;
  border: none;
  outline: none;
  background-color: transparent;
  font: inherit;
  cursor: text;
  appearance: textfield;
  @include song-mixin.value-text;
  @include song-mixin.disabled;

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }
}

.song-number-input:not(.flat) {
  $border-width: 1px;

  box-sizing: border-box;
  padding-right: calc(
    (song-vars.$size-control - song-vars.$size-control-small) / 2 -
      $border-width
  );
  border: $border-width solid var(--scheme-color-song-border);
  border-radius: song-vars.$radius-8;
  background-color: var(--scheme-color-surface-container-highest);

  .input {
    padding: 0 song-vars.$space-8;
  }

  &:has(.input:focus-visible) {
    outline: 2px solid var(--scheme-color-primary);
    outline-offset: -1px;
  }
}

.flat .input {
  border-radius: song-vars.$radius-6;
  @include song-mixin.state-layer;
  @include song-mixin.focus-ring;

  &:focus {
    background-color: var(--scheme-color-song-control-selected);
  }
}
</style>
