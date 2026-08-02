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
  waveformReferenceHeightPx: 56,
} as const;

export const VOLUME_EDITOR_LINE_WIDTH = {
  editedVolume: 2,
  hoveredVolume: 2,
  horizontalGrid: 1,
  tooltipGuide: 1,
} as const;

export const VOLUME_EDITOR_ALPHA = {
  minorGrid: 0.55,
  tooltipGuide: 0.45,
  erasePreviewOverlay: 0.12,
} as const;
