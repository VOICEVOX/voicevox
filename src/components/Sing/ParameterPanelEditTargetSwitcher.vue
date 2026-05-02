<template>
  <div
    class="edit-target-switcher"
    role="tablist"
    aria-label="パラメータ編集対象"
  >
    <button
      class="segment-switch"
      :class="{ active: editTarget === 'PHONEME_TIMING' }"
      type="button"
      role="tab"
      aria-label="音素タイミング"
      title="音素タイミング"
      :aria-selected="editTarget === 'PHONEME_TIMING'"
      @click="changeEditTarget('PHONEME_TIMING')"
    >
      <span class="material-symbols-rounded" aria-hidden="true">timer</span>
    </button>

    <button
      class="segment-switch"
      :class="{ active: editTarget === 'VOLUME' }"
      type="button"
      role="tab"
      aria-label="声量"
      title="声量"
      :aria-selected="editTarget === 'VOLUME'"
      @click="changeEditTarget('VOLUME')"
    >
      <span class="material-symbols-rounded" aria-hidden="true">
        volume_up
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ParameterPanelEditTarget } from "@/store/type";

defineProps<{
  editTarget: ParameterPanelEditTarget;
  changeEditTarget: (editTarget: ParameterPanelEditTarget) => void;
}>();
</script>

<style scoped lang="scss">
.edit-target-switcher {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 34px;
  padding: 1px;
  border-radius: 7px;
  background: var(--scheme-color-surface);
  box-shadow: 0 1px 3px oklch(0% 0 0 / 0.14);
  pointer-events: auto;
}

.segment-switch {
  display: grid;
  place-items: center;
  width: 32px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 5px;
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
    font-size: 17px;
    font-variation-settings: "FILL" 1;
    line-height: 1;
  }
}
</style>
