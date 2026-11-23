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
      @pointerdown="startRepeat($event, -1)"
      @pointerup="stopRepeat"
      @pointerleave="stopRepeat"
      @pointercancel="stopRepeat"
      @click="onClick($event, -1)"
    />
    <SongIconButton
      icon="add"
      :label="`${label}を増やす`"
      size="small"
      :disabled="disabled || (max != undefined && modelValue >= max)"
      @pointerdown="startRepeat($event, 1)"
      @pointerup="stopRepeat"
      @pointerleave="stopRepeat"
      @pointercancel="stopRepeat"
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

// ブラウザのnumber入力と同じく、打った値はEnterかフォーカスを外したとき、矢印キーは押すたびに確定する
// 値が変わったかを返す
const commit = (): boolean => {
  const input = inputElement.value;
  if (input == undefined) {
    throw new Error("input element is not mounted");
  }
  // 打った値はブラウザが範囲に収めないので、ここで収める
  const value = Math.min(
    props.max ?? Infinity,
    Math.max(props.min ?? -Infinity, input.valueAsNumber),
  );
  const changed = !Number.isNaN(value) && value !== props.modelValue;
  if (changed) {
    emit("update:modelValue", value);
  }
  // 数値にならなかったときや範囲に収めたときも、表示をmodelValueに戻す
  input.value = String(props.modelValue);
  return changed;
};

const stepBy = (direction: 1 | -1) => {
  const input = inputElement.value;
  if (input == undefined) {
    throw new Error("input element is not mounted");
  }
  if (direction === 1) {
    input.stepUp();
  } else {
    input.stepDown();
  }
  return commit();
};

// ブラウザの増減ボタンと同じく、押したらすぐ1回動き、押し続けると少し待ってからくり返す
const REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 60;
let repeatTimer: ReturnType<typeof setTimeout> | undefined;

const stopRepeat = () => {
  clearTimeout(repeatTimer);
  repeatTimer = undefined;
};

const startRepeat = (event: PointerEvent, direction: 1 | -1) => {
  if (event.button !== 0) return;
  stopRepeat();
  // 端に着いてボタンが無効になると離したことが届かないので、値が変わらなくなったら止める
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

// マウスやタッチは押したときに動かしているので、キーボードで押したときだけ動かす
const onClick = (event: MouseEvent, direction: 1 | -1) => {
  if (event.detail === 0) {
    stepBy(direction);
  }
};

onBeforeUnmount(stopRepeat);
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

  // ブラウザの増減ボタンは小さく狙いにくいので隠し、横のボタンと矢印キーで増減する
  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }
}

.song-number-input:not(.flat) {
  $border-width: 1px;

  box-sizing: border-box;
  // ボタンの右のすき間を、上下のすき間とそろえる
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
