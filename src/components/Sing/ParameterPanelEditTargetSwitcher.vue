<template>
  <div
    class="edit-target-switcher"
    :class="`${props.displayMode}-mode`"
    role="tablist"
    aria-label="パラメータ編集対象"
  >
    <button
      v-for="option in targetOptions"
      :key="option.value"
      class="segment-switch"
      :class="{ active: editTarget === option.value }"
      type="button"
      role="tab"
      :aria-label="option.ariaLabel"
      :title="option.ariaLabel"
      :aria-selected="editTarget === option.value"
      @click="changeEditTarget(option.value)"
    >
      <span v-if="props.displayMode === 'text'">{{ option.text }}</span>
      <span v-else class="edit-target-button-content">
        <span class="material-symbols-rounded" aria-hidden="true">
          {{ option.icon }}
        </span>
        <span class="edit-target-button-label">{{ option.shortText }}</span>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ParameterPanelEditTarget } from "@/store/type";

const props = withDefaults(
  defineProps<{
    editTarget: ParameterPanelEditTarget;
    changeEditTarget: (editTarget: ParameterPanelEditTarget) => void;
    displayMode?: "icon" | "text";
  }>(),
  {
    displayMode: "icon",
  },
);

const targetOptions = computed(() => {
  const volume = {
    value: "VOLUME" as const,
    text: "ボリューム",
    shortText: "声量",
    ariaLabel: "ボリューム",
    icon: "volume_up",
  };
  const phonemeTiming = {
    value: "PHONEME_TIMING" as const,
    text: "音素位置",
    shortText: "音素",
    ariaLabel: "音素位置",
    icon: "timer",
  };

  return props.displayMode === "text"
    ? [volume, phonemeTiming]
    : [
        { ...phonemeTiming, ariaLabel: "音素タイミング" },
        { ...volume, text: "声量", ariaLabel: "声量" },
      ];
});
</script>

<style scoped lang="scss">
.edit-target-switcher {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
  width: 48px;
  padding: 0;
  background: transparent;
  pointer-events: auto;
}

.segment-switch {
  box-sizing: border-box;
  display: grid;
  place-items: center;
  position: relative;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 0;
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
      var(--scheme-color-surface-container-highest) 68%,
      transparent
    );
    color: var(--scheme-color-on-surface);
  }

  &.active {
    z-index: 1;
    border-color: color-mix(
      in oklch,
      var(--scheme-color-outline-variant) 62%,
      transparent
    );
    border-right-color: color-mix(
      in oklch,
      var(--scheme-color-secondary) 34%,
      transparent
    );
    background: color-mix(
      in oklch,
      var(--scheme-color-secondary-container) 72%,
      var(--scheme-color-surface)
    );
    color: var(--scheme-color-on-secondary-container);
    box-shadow: -1px 1px 3px oklch(0% 0 0 / 0.12);
  }

  .material-symbols-rounded {
    font-size: 20px;
    font-variation-settings: "FILL" 1;
    line-height: 1;
  }
}

.edit-target-button-content {
  display: grid;
  place-items: center;
  gap: 2px;
  line-height: 1;
}

.edit-target-button-label {
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.text-mode {
  flex-direction: row;
  align-items: center;
  gap: 0;
  width: auto;
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
}

.text-mode .segment-switch {
  width: auto;
  min-width: 74px;
  height: 32px;
  padding: 0 10px;
  border: 0;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  border-radius: 5px;
}

.text-mode .segment-switch.active {
  background: color-mix(
    in oklch,
    var(--scheme-color-secondary-container) 72%,
    var(--scheme-color-surface)
  );
  color: var(--scheme-color-on-secondary-container);
  font-weight: 700;
  box-shadow:
    inset 0 0 0 1px
      color-mix(in oklch, var(--scheme-color-secondary) 38%, transparent),
    0 1px 2px oklch(0% 0 0 / 0.1);
}
</style>
