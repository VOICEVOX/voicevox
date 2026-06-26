<template>
  <div
    v-if="editTarget === 'NOTE'"
    class="tool-palette"
    :class="`orientation-${orientation}`"
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
    :class="`orientation-${orientation}`"
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

withDefaults(
  defineProps<{
    editTarget: SequencerEditTarget;
    sequencerNoteTool: NoteEditTool;
    sequencerPitchTool: PitchEditTool;
    orientation?: "vertical" | "horizontal";
  }>(),
  {
    orientation: "vertical",
  },
);
const emit = defineEmits<{
  (event: "update:sequencerNoteTool", value: NoteEditTool): void;
  (event: "update:sequencerPitchTool", value: PitchEditTool): void;
}>();
</script>

<style scoped lang="scss">
.tool-palette {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 1px;
  border-radius: 7px;
  border: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 42%, transparent);
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-lowest) 94%,
    transparent
  );
  box-shadow: 0 2px 6px oklch(0% 0 0 / 0.08);
  gap: 2px;
  pointer-events: auto;
}

.orientation-vertical {
  flex-direction: column;
  width: 34px;
}

.orientation-horizontal {
  flex-direction: row;
  width: auto;
}

.tool-palette-button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: color-mix(
    in oklch,
    var(--scheme-color-on-surface-variant) 78%,
    var(--scheme-color-primary)
  );
  cursor: pointer;

  &:hover {
    background: color-mix(
      in oklch,
      var(--scheme-color-surface-container-highest) 74%,
      transparent
    );
    color: var(--scheme-color-on-surface);
  }

  &.active {
    background: var(--scheme-color-surface);
    color: var(--scheme-color-on-surface);
    box-shadow:
      inset 0 0 0 1px
        color-mix(in oklch, var(--scheme-color-primary) 34%, transparent),
      0 1px 2px oklch(0% 0 0 / 0.1);
  }

  .material-symbols-rounded {
    font-size: 18px;
    font-variation-settings: "FILL" 1;
    line-height: 1;
  }
}
</style>
