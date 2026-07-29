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
import { computed } from "vue";
import {
  VOLUME_EDITOR_ALPHA,
  VOLUME_EDITOR_LAYOUT,
  VOLUME_EDITOR_LINE_WIDTH,
} from "./style";
import { clamp } from "@/sing/utility";

defineOptions({
  name: "VolumeEditorTooltip",
});

type VolumeEditorTooltipState = {
  value: string;
  pointerX: number;
  pointerY: number;
};

const props = defineProps<{
  state?: VolumeEditorTooltipState;
  viewportWidth?: number;
  viewportHeight?: number;
}>();

// NOTE: ツールチップは描画中の視線方向（右下）に置くと目に入りやすく、描く先も隠さない。
// エリア端でも反転はさせず、余計な注意を引かないようにする。
const tooltipStyle = computed(() => {
  const tooltip = props.state;
  const width = props.viewportWidth;
  const height = props.viewportHeight;
  if (tooltip == undefined || width == undefined || height == undefined) {
    return undefined;
  }
  const minLeft = VOLUME_EDITOR_LAYOUT.tooltipPaddingPx;
  // エリアが狭くてツールチップが余白内に収まらない場合は、
  // 左上の余白位置に置き、右下へのはみ出しは許容する
  const maxLeft = Math.max(
    minLeft,
    width - VOLUME_EDITOR_LAYOUT.tooltipWidthPx - minLeft,
  );
  const minTop = VOLUME_EDITOR_LAYOUT.tooltipPaddingPx;
  const maxTop = Math.max(
    minTop,
    height - VOLUME_EDITOR_LAYOUT.tooltipHeightPx - minTop,
  );
  const left = clamp(
    tooltip.pointerX + VOLUME_EDITOR_LAYOUT.tooltipOffsetPx,
    minLeft,
    maxLeft,
  );
  const top = clamp(
    tooltip.pointerY + VOLUME_EDITOR_LAYOUT.tooltipOffsetPx,
    minTop,
    maxTop,
  );
  return {
    left: `${left}px`,
    top: `${top}px`,
  };
});

const guideLineStyle = computed(() => {
  const tooltip = props.state;
  if (tooltip == undefined) {
    return undefined;
  }
  return {
    left: `${VOLUME_EDITOR_LAYOUT.keyColumnWidthPx}px`,
    top: `${tooltip.pointerY}px`,
  };
});
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
