<template>
  <BaseContextMenu @update:open="handleUpdateOpen">
    <div class="wrapper">
      <div
        :id
        ref="inputRef"
        role="textbox"
        aria-multiline="false"
        spellcheck="false"
        class="input"
        :class="{ error: hasError, readonly, disabled }"
        :contenteditable="!readonly && !disabled ? 'plaintext-only' : false"
        @click="$emit('click', $event)"
        @blur="$emit('change', $event)"
        @input="handleInput"
        @paste="handlePaste"
        @keydown="preventEnter"
        v-text="innerValue"
      />
      <div v-if="placeholder && !model" class="placeholder">
        {{ placeholder }}
      </div>

      <div v-if="hasError" class="error-label">
        <slot name="error" />
      </div>
    </div>

    <template #menu>
      <BaseContextMenuItem
        label="切り取り"
        shortcut="Ctrl+X"
        :disabled="disabled || readonly || !isTextSelected"
        @select="cut"
      />
      <BaseContextMenuItem
        label="コピー"
        shortcut="Ctrl+C"
        :disabled="disabled || !isTextSelected"
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
        :disabled="disabled || readonly"
        @select="selectAll"
      />
      <BaseContextMenuSeparator v-if="slot['contextMenu'] != null" />
      <slot name="contextMenu" />
    </template>
  </BaseContextMenu>
</template>

<script setup lang="ts">
import { computed, ref, useSlots, useTemplateRef } from "vue";
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

const emit = defineEmits<{
  change: [payload: Event];
  click: [payload: MouseEvent];
}>();

const model = defineModel<string>();
const slot = useSlots();
const inputRef = useTemplateRef("inputRef");

const innerValue = ref<string>(model.value ?? "");

const selectionOffset = ref<{ start: number; end: number }>({
  start: 0,
  end: 0,
});

const isTextSelected = computed(
  () => selectionOffset.value.start < selectionOffset.value.end,
);

const getInputOrThrow = (): HTMLDivElement => {
  const element = inputRef.value;
  if (!(element instanceof HTMLDivElement)) {
    throw new Error("inputRef is not div");
  }
  return element;
};

const getSelectionRange = () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount <= 0) {
    throw new Error("test");
  }
  const range = selection.getRangeAt(0);
  return { start: range.startOffset, end: range.endOffset };
};

const restoreSelection = () => {
  const input = getInputOrThrow();

  if (input.firstChild == null) {
    throw new Error("input.firstChild is null");
  }

  const range = document.createRange();
  range.setStart(input.firstChild, selectionOffset.value.start);
  range.setEnd(input.firstChild, selectionOffset.value.end);

  const selection = window.getSelection();

  if (selection == null) {
    throw new Error("selection is null");
  }

  selection.removeAllRanges();
  selection.addRange(range);
};

const replaceSelection = (text: string) => {
  const selection = window.getSelection();
  if (selection == null) {
    throw new Error("selection is null");
  }

  if (selection.rangeCount === 0) {
    throw new Error("No selection range found");
  }

  const range = selection.getRangeAt(0);
  const input = getInputOrThrow();

  const before = input.innerText.slice(0, range.startOffset);
  const after = input.innerText.slice(range.endOffset);
  const newText = before + text + after;

  input.textContent = newText;
  model.value = newText;

  const offset = before.length + text.length;
  selectionOffset.value = { start: offset, end: offset };
};

const handleUpdateOpen = (isOpened: boolean) => {
  if (isOpened) {
    selectionOffset.value = getSelectionRange();
  } else {
    setTimeout(restoreSelection, 1);
  }
};

const handleInput = () => {
  const input = getInputOrThrow();
  model.value = input.textContent ?? "";
};

const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault();
  void paste();

  setTimeout(restoreSelection, 1);
};

const preventEnter = (event: KeyboardEvent) => {
  if (event.key == "Enter") {
    event.preventDefault();
    emit("change", event);
  }
};

const cut = async () => {
  await copy();
  replaceSelection("");
};

const copy = async () => {
  const selection = window.getSelection();
  if (selection) {
    await navigator.clipboard.writeText(selection.toString());
  }
};

const paste = async () => {
  const text = await navigator.clipboard.readText();
  replaceSelection(text.replace(/\n/g, " "));
};

const selectAll = () => {
  const input = getInputOrThrow();
  const textContent = input.textContent;

  if (textContent == null) {
    throw new Error("input.textContent is null");
  }

  selectionOffset.value = { start: 0, end: textContent.length };
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;

.wrapper {
  width: 100%;
  position: relative;
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
  padding-block: calc((#{vars.$size-control} - 1rem) / 2);
  background-color: colors.$control;
  color: colors.$display;
  line-height: 1rem;
  text-wrap: nowrap;
  overflow-x: scroll;
  overflow-y: hidden;

  &:focus,
  [data-state="open"] > & {
    @include mixin.on-focus;
  }

  &:disabled {
    opacity: 0.5;
  }

  &::placeholder {
    color: colors.$display-sub;
  }

  &::-webkit-scrollbar {
    display: none;
  }
}

.placeholder {
  position: absolute;
  inset: 0;
  opacity: 0.5;
  display: flex;
  align-items: center;
  padding-inline: vars.$padding-1;
  pointer-events: none;
}

.error {
  @include mixin.on-focus;
  outline-color: colors.$display-warning !important;
}

.error-label {
  color: colors.$display-warning;
}
</style>
