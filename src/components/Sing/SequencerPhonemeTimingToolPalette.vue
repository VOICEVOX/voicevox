<template>
  <div class="tool-palette">
    <QBtn
      flat
      round
      :color="sequencerPhonemeTimingTool === 'MOVE' ? 'primary' : ''"
      @click="$emit('update:sequencerPhonemeTimingTool', 'MOVE')"
    >
      <i class="material-symbols-outlined">swap_horiz</i>
      <QTooltip
        anchor="center right"
        self="center left"
        :offset="[8, 0]"
        :delay="500"
        transitionShow=""
        transitionHide=""
      >
        移動
      </QTooltip>
    </QBtn>
    <QBtn
      flat
      round
      :color="sequencerPhonemeTimingTool === 'ERASE' ? 'primary' : ''"
      @click="$emit('update:sequencerPhonemeTimingTool', 'ERASE')"
    >
      <i class="material-symbols-outlined">ink_eraser</i>
      <QTooltip
        anchor="center right"
        self="center left"
        :offset="[8, 0]"
        :delay="500"
        transitionShow=""
        transitionHide=""
      >
        削除
      </QTooltip>
    </QBtn>
  </div>
</template>

<script setup lang="ts">
import type { PhonemeTimingEditTool } from "@/store/type";

defineProps<{
  sequencerPhonemeTimingTool: PhonemeTimingEditTool;
}>();
defineEmits<{
  (
    event: "update:sequencerPhonemeTimingTool",
    value: PhonemeTimingEditTool,
  ): void;
}>();
</script>

<style scoped lang="scss">
.tool-palette {
  display: flex;
  flex-direction: column;
  background: var(--scheme-color-surface);
  outline: 1px solid var(--scheme-color-outline-variant);
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: var(--z-index-sing-tool-palette);
  padding: 2px;
  border-radius: 24px;
  gap: 0;
  box-shadow:
    0px 8px 16px -4px rgba(0, 0, 0, 0.1),
    0px 4px 8px -4px rgba(0, 0, 0, 0.06);

  .material-symbols-outlined {
    font-size: 20px;
    max-width: 20px;
  }

  .q-btn {
    min-height: 40px;
    min-width: 40px;
    padding: 8px;

    &.text-primary {
      background-color: var(--scheme-color-secondary-container);
      .material-symbols-outlined {
        color: var(--scheme-color-on-primary-container);
      }
    }
  }
}
</style>
