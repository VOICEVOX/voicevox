<template>
  <div
    class="tool-palette"
    :class="`orientation-${orientation}`"
    aria-label="声量ツール"
  >
    <button
      v-for="toolItem in toolItems"
      :key="toolItem.value"
      class="tool-palette-button"
      :class="{ active: sequencerVolumeTool === toolItem.value }"
      type="button"
      :aria-label="toolItem.label"
      :title="toolItem.label"
      @click="emit('update:sequencerVolumeTool', toolItem.value)"
    >
      <span class="material-symbols-rounded" aria-hidden="true">
        {{ toolItem.icon }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { VolumeEditTool } from "@/store/type";

withDefaults(
  defineProps<{
    sequencerVolumeTool: VolumeEditTool;
    orientation?: "vertical" | "horizontal";
  }>(),
  {
    orientation: "vertical",
  },
);

const emit = defineEmits<{
  (event: "update:sequencerVolumeTool", value: VolumeEditTool): void;
}>();

const toolItems: {
  value: VolumeEditTool;
  label: string;
  icon: string;
}[] = [
  { value: "SELECT", label: "範囲選択", icon: "select_all" },
  { value: "DRAW", label: "編集", icon: "edit" },
  { value: "ERASE", label: "消しゴム", icon: "ink_eraser" },
];
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
  gap: 1px;
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
    var(--scheme-color-secondary)
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
    background: var(--scheme-color-secondary-container);
    color: var(--scheme-color-on-secondary-container);
    box-shadow: none;
  }

  &.active:hover {
    background: color-mix(
      in oklch,
      var(--scheme-color-secondary-container) 84%,
      var(--scheme-color-secondary)
    );
    color: var(--scheme-color-on-secondary-container);
  }

  .material-symbols-rounded {
    font-size: 17px;
    font-variation-settings: "FILL" 1;
    line-height: 1;
  }
}
</style>
