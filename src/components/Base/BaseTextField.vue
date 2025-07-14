<template>
  <BaseContextMenu @update:open="handleUpdateOpen">
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
        :disabled
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

defineEmits<{
  change: [payload: Event];
  click: [payload: MouseEvent];
}>();

const model = defineModel<string>();
const slot = useSlots();
const inputRef = useTemplateRef("inputRef");

const selection = ref<{ start: number; end: number }>({ start: 0, end: 0 });

const getInputOrThrow = () => {
  const input = inputRef.value;
  if (input == null) {
    throw new Error("inputRef is null");
  }

  return input;
};

const handleUpdateOpen = (isOpened: boolean) => {
  if (isOpened) {
    const input = getInputOrThrow();
    const { selectionStart, selectionEnd } = input;

    if (selectionStart == null || selectionEnd == null) {
      throw new Error("selection is null");
    }

    selection.value = { start: selectionStart, end: selectionEnd };
  } else {
    const input = getInputOrThrow();

    // inputにfocusが戻ったあとに実行するため遅延させる
    setTimeout(() => {
      input.selectionStart = selection.value.start;
      input.selectionEnd = selection.value.end;
    }, 1);
  }
};

const isTextSelected = computed(
  () => selection.value.start < selection.value.end,
);

const replaceSelection = (text: string) => {
  const input = getInputOrThrow();
  model.value =
    input.value.slice(0, selection.value.start) +
    text +
    input.value.slice(selection.value.end);

  // inputにfocusが戻ったあとに実行するため遅延させる
  selection.value = {
    start: selection.value.start,
    end: selection.value.start + text.length,
  };
};

const cut = async () => {
  await copy();
  replaceSelection("");
};

const copy = async () => {
  const input = getInputOrThrow();

  const text = input.value.slice(selection.value.start, selection.value.end);
  await navigator.clipboard.writeText(text);
};

const paste = async () => {
  const text = await navigator.clipboard.readText();
  replaceSelection(text);
};

const selectAll = () => {
  const input = getInputOrThrow();
  selection.value = {
    start: 0,
    end: input.value.length,
  };
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
}

.error {
  @include mixin.on-focus;
  outline-color: colors.$display-warning !important;
}

.error-label {
  color: colors.$display-warning;
}
</style>
