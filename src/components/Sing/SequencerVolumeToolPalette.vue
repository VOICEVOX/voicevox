<template>
  <div class="tool-palette" aria-label="声量ツール">
    <button
      class="tool-palette-button"
      :class="{ active: sequencerVolumeTool === 'DRAW' }"
      type="button"
      aria-label="ボリューム描画"
      title="ボリューム描画"
      @click="emit('update:sequencerVolumeTool', 'DRAW')"
    >
      <span class="material-symbols-rounded">stylus</span>
    </button>
    <button
      class="tool-palette-button"
      :class="{ active: sequencerVolumeTool === 'ERASE' }"
      type="button"
      aria-label="ボリューム削除"
      title="ボリューム削除"
      @click="emit('update:sequencerVolumeTool', 'ERASE')"
    >
      <span class="material-symbols-rounded">ink_eraser</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { VolumeEditTool } from "@/store/type";

defineProps<{
  sequencerVolumeTool: VolumeEditTool;
}>();

const emit = defineEmits<{
  (event: "update:sequencerVolumeTool", value: VolumeEditTool): void;
}>();
</script>

<style scoped lang="scss">
.tool-palette {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 34px;
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
