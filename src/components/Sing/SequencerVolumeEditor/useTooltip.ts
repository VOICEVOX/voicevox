import { computed } from "vue";
import { VOLUME_EDITOR_LAYOUT } from "./style";
import { clamp } from "@/sing/utility";

type ReadonlyRef<T> = {
  readonly value: T;
};

export type VolumeEditorTooltipState = {
  value: string;
  pointerX: number;
  pointerY: number;
};

type UseVolumeEditorTooltipOptions = {
  tooltipState: ReadonlyRef<VolumeEditorTooltipState | undefined>;
  viewportWidth: ReadonlyRef<number | undefined>;
  viewportHeight: ReadonlyRef<number | undefined>;
};

// 現時点ではボリュームエディタ専用の配置・サイズで扱う。
// 別の画面でも必要になった時点で、汎用のfloating tooltip composableへ切り出す。
export const useVolumeEditorTooltip = ({
  tooltipState,
  viewportWidth,
  viewportHeight,
}: UseVolumeEditorTooltipOptions) => {
  // NOTE: ツールチップは描画中の視線方向（右下）に置くと目に入りやすく、描く先も隠さない。
  // エリア端でも反転はさせず、余計な注意を引かないようにする。
  const tooltipStyle = computed(() => {
    const tooltip = tooltipState.value;
    const width = viewportWidth.value;
    const height = viewportHeight.value;
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

  const tooltipGuideLineStyle = computed(() => {
    const tooltip = tooltipState.value;
    if (tooltip == undefined) {
      return undefined;
    }
    return {
      left: `${VOLUME_EDITOR_LAYOUT.keyColumnWidthPx}px`,
      top: `${tooltip.pointerY}px`,
    };
  });

  return {
    tooltipStyle,
    tooltipGuideLineStyle,
  };
};
