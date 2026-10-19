<template>
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
import { VOLUME_EDITOR_LAYOUT } from "./style";
import { clamp } from "@/song/utility";

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
  const minLeft = VOLUME_EDITOR_LAYOUT.keyColumnWidthPx;
  // エリアが狭くてツールチップが収まらない場合は、
  // レーンの左上に置き、右下へのはみ出しは許容する
  const maxLeft = Math.max(
    minLeft,
    width - VOLUME_EDITOR_LAYOUT.tooltipClampWidthPx,
  );
  const minTop = 0;
  const maxTop = Math.max(
    minTop,
    height - VOLUME_EDITOR_LAYOUT.tooltipHeightPx,
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
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

.volume-value-tooltip {
  position: absolute;
  z-index: calc(#{vars.$z-index-song-tool-palette} + 1);
  box-sizing: border-box;
  min-width: v-bind("`${VOLUME_EDITOR_LAYOUT.tooltipMinWidthPx}px`");
  height: v-bind("`${VOLUME_EDITOR_LAYOUT.tooltipHeightPx}px`");
  padding: 0 8px;
  border-radius: var(--radius-basis);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scheme-color-song-parameter-tooltip-container);
  border: 1px solid var(--scheme-color-song-parameter-tooltip-border);
  color: var(--scheme-color-song-on-parameter-tooltip-container);
  box-shadow: 0 2px 4px var(--scheme-color-song-parameter-tooltip-shadow);
  font-size: 12px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}
</style>
