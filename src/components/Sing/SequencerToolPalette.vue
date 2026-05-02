<template>
  <div
    v-if="editTarget === 'NOTE'"
    class="tool-palette"
    aria-label="ノートツール"
  >
    <button
      class="tool-palette-button"
      :class="{ active: sequencerNoteTool === 'SELECT_FIRST' }"
      type="button"
      aria-label="選択優先"
      title="選択優先"
      @click="emit('update:sequencerNoteTool', 'SELECT_FIRST')"
    >
      <span class="material-symbols-rounded">arrow_selector_tool</span>
    </button>
    <button
      class="tool-palette-button"
      :class="{ active: sequencerNoteTool === 'EDIT_FIRST' }"
      type="button"
      aria-label="編集優先"
      title="編集優先"
      @click="emit('update:sequencerNoteTool', 'EDIT_FIRST')"
    >
      <span class="material-symbols-rounded">stylus</span>
    </button>
  </div>
  <div
    v-else-if="editTarget === 'PITCH'"
    class="tool-palette"
    aria-label="ピッチツール"
  >
    <button
      class="tool-palette-button"
      :class="{ active: sequencerPitchTool === 'DRAW' }"
      type="button"
      aria-label="ピッチ編集"
      title="ピッチ編集"
      @click="emit('update:sequencerPitchTool', 'DRAW')"
    >
      <span class="material-symbols-rounded">stylus</span>
    </button>
    <button
      class="tool-palette-button"
      :class="{ active: sequencerPitchTool === 'ERASE' }"
      type="button"
      aria-label="ピッチ削除"
      title="ピッチ削除"
      @click="emit('update:sequencerPitchTool', 'ERASE')"
    >
      <span class="material-symbols-rounded">ink_eraser</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type {
  SequencerEditTarget,
  NoteEditTool,
  PitchEditTool,
} from "@/store/type";

defineProps<{
  editTarget: SequencerEditTarget;
  sequencerNoteTool: NoteEditTool;
  sequencerPitchTool: PitchEditTool;
}>();
const emit = defineEmits<{
  (event: "update:sequencerNoteTool", value: NoteEditTool): void;
  (event: "update:sequencerPitchTool", value: PitchEditTool): void;
}>();
</script>

<style scoped lang="scss">
.tool-palette {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: auto;
  padding: 1px;
  border-radius: 7px;
  background: color-mix(in oklch, var(--scheme-color-surface) 86%, transparent);
  box-shadow: 0 1px 3px oklch(0% 0 0 / 0.12);
  gap: 2px;
  pointer-events: auto;
}

.tool-palette-button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--scheme-color-on-surface-variant);
  cursor: pointer;

  &:hover {
    background: var(--scheme-color-surface-container-highest);
    color: var(--scheme-color-on-surface);
  }

  &.active {
    background: color-mix(
      in oklch,
      var(--scheme-color-secondary-container) 72%,
      var(--scheme-color-surface)
    );
    color: var(--scheme-color-on-secondary-container);
    box-shadow:
      inset 0 0 0 1px
        color-mix(in oklch, var(--scheme-color-secondary) 38%, transparent),
      0 1px 2px oklch(0% 0 0 / 0.1);
  }

  .material-symbols-rounded {
    font-size: 18px;
    font-variation-settings: "FILL" 1;
    line-height: 1;
  }
}
</style>
