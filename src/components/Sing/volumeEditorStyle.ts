export const VOLUME_EDITOR_LAYOUT = {
  keyColumnWidthPx: 48,
  tooltipWidthPx: 64,
  // ツールチップの実高さ（line-height 14px + 上下padding 3px）。エリア端でのクランプ計算に使う
  tooltipHeightPx: 20,
  tooltipOffsetPx: 16,
  tooltipPaddingPx: 4,
  denseGridLabelMinHeightPx: 120,
  sparseGridLabelMinHeightPx: 80,
  gridLabelEdgeMarginPx: 8,
  editableRangeBandHeightPx: 3,
} as const;

export const VOLUME_EDITOR_LINE_WIDTH = {
  originalVolume: 1,
  editedVolume: 1.5,
  horizontalGrid: 1,
  tooltipGuide: 1,
} as const;

export const VOLUME_EDITOR_ALPHA = {
  editedVolumeArea: 0.1,
  horizontalGrid: 0.16,
  horizontalGridBaseline: 0.28,
  tooltipGuide: 0.45,
  erasePreviewOverlay: 0.12,
  editableRangeBand: 0.4,
} as const;

// NOTE: PIXI.GraphicsはCSS変数を参照できないため、sing-colors.scssの色の近似hex値をハードコードしている
export const VOLUME_GRAPHICS_COLORS = {
  horizontalLineLight: 0xadadad,
  horizontalLineDark: 0x585858,
  erasePreviewOverlay: 0x000000,
} as const;
