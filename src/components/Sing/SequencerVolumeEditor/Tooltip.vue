<template>
  <div
    v-if="state != undefined"
    class="volume-value-guide-line"
    :style="guideLineStyle"
  ></div>
  <div
    v-if="state != undefined"
    class="volume-value-tooltip"
    :style="tooltipStyle"
  >
    {{ state.value }}
  </div>
</template>

<script setup lang="ts">
import type { StyleValue } from "vue";
import {
  VOLUME_EDITOR_ALPHA,
  VOLUME_EDITOR_LAYOUT,
  VOLUME_EDITOR_LINE_WIDTH,
} from "./style";
import type { VolumeEditorTooltipState } from "./useTooltip";

defineOptions({
  name: "VolumeEditorTooltip",
});

defineProps<{
  state?: VolumeEditorTooltipState;
  tooltipStyle?: StyleValue;
  guideLineStyle?: StyleValue;
}>();
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

.volume-value-guide-line {
  position: absolute;
  right: 0;
  z-index: 2;
  height: 0;
  border-top: v-bind("`${VOLUME_EDITOR_LINE_WIDTH.tooltipGuide}px`") solid
    color-mix(in oklch, var(--scheme-color-primary) 60%, transparent);
  opacity: v-bind("VOLUME_EDITOR_ALPHA.tooltipGuide");
  transform: translateY(-0.5px);
  pointer-events: none;
}

.volume-value-tooltip {
  position: absolute;
  z-index: calc(#{vars.$z-index-sing-tool-palette} + 1);
  box-sizing: border-box;
  width: v-bind("`${VOLUME_EDITOR_LAYOUT.tooltipWidthPx}px`");
  min-height: v-bind("`${VOLUME_EDITOR_LAYOUT.tooltipHeightPx}px`");
  padding: 3px 6px;
  border-radius: 4px;
  // カーブと重なっても下が透けて見えるように半透明にする
  background: rgb(0 0 0 / 72%);
  color: #fff;
  font-size: 11px;
  line-height: 14px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}
</style>
