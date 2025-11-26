<template>
  <div class="tool-palette">
    <QBtn
      flat
      round
      :color="sequencerVolumeTool === 'DRAW' ? 'primary' : ''"
      @click="$emit('update:sequencerVolumeTool', 'DRAW')"
    >
      <i class="material-symbols-outlined">stylus</i>
      <QTooltip
        anchor="center right"
        self="center left"
        :offset="[8, 0]"
        :delay="500"
        transitionShow=""
        transitionHide=""
      >
        ボリューム描画
      </QTooltip>
    </QBtn>
    <QBtn
      flat
      round
      :color="sequencerVolumeTool === 'ERASE' ? 'primary' : ''"
      @click="$emit('update:sequencerVolumeTool', 'ERASE')"
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
        ボリューム削除
      </QTooltip>
    </QBtn>
  </div>
</template>

<script setup lang="ts">
import { QBtn, QTooltip } from "quasar";
import type { VolumeEditTool } from "@/store/type";

defineProps<{
  sequencerVolumeTool: VolumeEditTool;
}>();

defineEmits<{
  (event: "update:sequencerVolumeTool", value: VolumeEditTool): void;
}>();
</script>

<style scoped lang="scss">
.tool-palette {
  display: flex;
  flex-direction: column;
  background: var(--scheme-color-surface);
  outline: 1px solid var(--scheme-color-outline-variant);
  position: absolute;
  top: 12px;
  left: 64px;
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
