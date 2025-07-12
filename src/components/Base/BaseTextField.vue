<template>
  <BaseContextMenu>
    <div class="wrapper">
      <input
        :id
        ref="inputRef"
        v-model="model"
        type="text"
        class="input"
        :class="{ error: hasError }"
        :placeholder
        :readonly
        :disabled
        @change="(payload) => $emit('change', payload)"
        @click="(payload) => $emit('click', payload)"
      />
      <div v-if="hasError" class="error-label">
        <slot name="error" />
      </div>
    </div>
    <template #menu>
      <BaseContextMenuItem
        label="切り取り"
        shortcut="Ctrl+X"
        :disabled="disabled || readonly || !isTextSelected()"
        @select="cut"
      />
      <BaseContextMenuItem
        label="コピー"
        shortcut="Ctrl+C"
        :disabled="disabled || !isTextSelected()"
        @select="copy"
      />
      <BaseContextMenuItem
        label="貼り付け"
        shortcut="Ctrl+V"
        :disabled="disabled || readonly"
        @select="paste"
      />
      <BaseContextMenuSeparator />
      <BaseContextMenuItem
        label="すべて選択"
        shortcut="Ctrl+A"
        :disabled
        @select="selectAll"
      />
    </template>
  </BaseContextMenu>
</template>

<script setup lang="ts">
import { useTemplateRef } from "vue";
import BaseContextMenu from "./BaseContextMenu.vue";
import BaseContextMenuItem from "./BaseContextMenuItem.vue";
import BaseContextMenuSeparator from "./BaseContextMenuSeparator.vue";

defineProps<{
  placeholder?: string;
  hasError?: boolean;
  readonly?: boolean;
  disabled?: boolean;
  id?: string;
}>();

defineEmits<{
  change: [payload: Event];
  click: [payload: MouseEvent];
}>();

const model = defineModel<string>();

const inputRef = useTemplateRef("inputRef");

const isTextSelected = () => {
  const input = inputRef.value;
  if (input == null) {
    throw new Error("inputRef is null");
  }

  const selection = getSelection(input);

  return selection.start < selection.end;
};

const getSelection = (input: HTMLInputElement) => {
  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;

  if (selectionStart == null || selectionEnd == null) {
    throw new Error("selection is null");
  }

  return {
    start: selectionStart,
    end: selectionEnd,
  };
};

const replaceSelection = (input: HTMLInputElement, text: string) => {
  const selection = getSelection(input);

  const beforeText = input.value.substring(0, selection.start);
  const afterText = input.value.substring(selection.end);

  model.value = beforeText + text + afterText;

  // inputにfocusが戻ったあとに実行するため遅延させる
  setTimeout(() => {
    input.selectionStart = selection.start;
    input.selectionEnd = selection.start + text.length;
  }, 0);
};

const cut = async () => {
  const input = inputRef.value;
  if (input == null) {
    throw new Error("inputRef is null");
  }

  const selection = getSelection(input);

  const text = input.value.substring(selection.start, selection.end);
  await navigator.clipboard.writeText(text);

  replaceSelection(input, "");
};

const copy = async () => {
  const input = inputRef.value;
  if (input == null) {
    throw new Error("inputRef is null");
  }

  const selection = getSelection(input);

  const text = input.value.substring(selection.start, selection.end);
  await navigator.clipboard.writeText(text);

  // inputにfocusが戻ったあとに実行するため遅延させる
  setTimeout(() => {
    input.selectionStart = selection.start;
    input.selectionEnd = selection.end;
  }, 0);
};

const paste = async () => {
  const input = inputRef.value;
  if (input == null) {
    throw new Error("inputRef is null");
  }

  const text = await navigator.clipboard.readText();
  replaceSelection(input, text);
};

const selectAll = () => {
  if (inputRef.value) {
    inputRef.value.select();
  }
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;

.wrapper {
  width: 100%;
}

.input {
  height: vars.$size-control;
  width: 100%;
  display: flex;
  align-items: center;
  gap: vars.$gap-1;
  border: 1px solid colors.$border;
  border-radius: vars.$radius-1;
  padding-inline: vars.$padding-1;
  background-color: colors.$control;
  color: colors.$display;

  &:focus {
    @include mixin.on-focus;
  }

  &:disabled {
    opacity: 0.5;
  }

  &::placeholder {
    color: colors.$display-sub;
  }
}

.error {
  @include mixin.on-focus;
  outline-color: colors.$display-warning !important;
}

.error-label {
  color: colors.$display-warning;
}
</style>
