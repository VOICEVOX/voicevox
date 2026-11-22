<template>
  <div class="song-number-input" :class="variant">
    <input
      ref="input"
      type="number"
      class="input"
      :aria-label="label"
      :disabled
      :value="draft ?? modelValue"
      @focus="startEditing"
      @input="draft = ($event.target as HTMLInputElement).value"
      @keydown="onKeydown"
      @blur="commit"
    />
    <!-- 入力中に押しても入力欄からフォーカスを外さず、続けて打てるようにする -->
    <SongIconButton
      icon="remove"
      :label="`${label}を減らす`"
      size="small"
      :disabled="disabled || currentValue <= min"
      @pointerdown.prevent
      @click="stepBy(-1)"
    />
    <SongIconButton
      icon="add"
      :label="`${label}を増やす`"
      size="small"
      :disabled="disabled || currentValue >= max"
      @pointerdown.prevent
      @click="stepBy(1)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef } from "vue";
import SongIconButton from "./SongIconButton.vue";

const props = withDefaults(
  defineProps<{
    modelValue: number;
    label: string;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    /** flatはツールバーのように、ほかのコンポーネントと並べて置く場所で使う */
    variant?: "default" | "flat";
  }>(),
  {
    min: -Infinity,
    max: Infinity,
    step: 1,
    disabled: false,
    variant: "default",
  },
);

// 範囲外などで採用されなかった場合も、表示はmodelValueに戻る
const emit = defineEmits<{
  /** 表示する値。増減ボタンでは押すたびに通知する */
  "update:modelValue": [value: number];
  /** 確定した値。増減ボタンでは、連続して押した分を1つにまとめて通知する */
  valueCommit: [value: number];
}>();

const inputElement = useTemplateRef<HTMLInputElement>("input");

// 編集中の文字列。確定や取り消しで破棄し、表示をmodelValueに戻す
const draft = ref<string>();

const clamp = (value: number) =>
  Math.min(props.max, Math.max(props.min, value));

// 表示している値。編集中なら入力した値、そうでなければmodelValue
const currentValue = computed(() => {
  if (draft.value == undefined) {
    return props.modelValue;
  }
  const value = Number(draft.value.trim());
  return draft.value.trim() !== "" && Number.isFinite(value)
    ? value
    : props.modelValue;
});

// 増減ボタンを押し終わってから確定するまでの待ち時間。BaseSliderのホイール操作に合わせる
const COMMIT_DELAY_MS = 300;
let pendingCommit:
  { value: number; timer: ReturnType<typeof setTimeout> } | undefined;

const commitValue = (value: number) => {
  if (pendingCommit != undefined) {
    clearTimeout(pendingCommit.timer);
    pendingCommit = undefined;
  }
  emit("valueCommit", value);
};

const commitValueLater = (value: number) => {
  if (pendingCommit != undefined) {
    clearTimeout(pendingCommit.timer);
  }
  pendingCommit = {
    value,
    timer: setTimeout(() => commitValue(value), COMMIT_DELAY_MS),
  };
};

onBeforeUnmount(() => {
  if (pendingCommit != undefined) {
    commitValue(pendingCommit.value);
  }
});

// フォーカス中に親から値が変わっても古い値で上書きしないよう、編集中の値はフォーカスでは作らず、入力したときに作る
const startEditing = () => {
  // すぐに打ち直せるよう、フォーカスしたら全体を選ぶ
  inputElement.value?.select();
};

const commit = () => {
  if (draft.value == undefined) {
    return;
  }
  const value = clamp(currentValue.value);
  draft.value = undefined;
  if (value !== props.modelValue) {
    emit("update:modelValue", value);
    commitValue(value);
  }
};

const cancel = () => {
  draft.value = undefined;
  inputElement.value?.blur();
};

const stepBy = (direction: 1 | -1) => {
  const value = clamp(currentValue.value + props.step * direction);
  draft.value = undefined;
  if (value !== props.modelValue) {
    emit("update:modelValue", value);
    commitValueLater(value);
  }
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    commit();
    inputElement.value?.blur();
  } else if (event.key === "Escape") {
    cancel();
  } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    // 押すたびに確定すると履歴が増えるため、増減は編集中の値にとどめ、確定はEnterかフォーカスを外したときに行う
    event.preventDefault();
    const direction = event.key === "ArrowUp" ? 1 : -1;
    draft.value = String(clamp(currentValue.value + props.step * direction));
  }
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/song-variables" as song-vars;
@use "@/styles/v2/song-mixin" as song-mixin;

.song-number-input {
  display: inline-flex;
  align-items: center;
  gap: song-vars.$space-2;
  height: song-vars.$size-control;
}

.input {
  field-sizing: content;
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

.default {
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

  // 入力中であることが分かるよう、背景を濃くする
  &:focus {
    background-color: var(--scheme-color-song-control-selected);
  }
}
</style>
