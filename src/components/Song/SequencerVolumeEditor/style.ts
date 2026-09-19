export const VOLUME_EDITOR_LAYOUT = {
  keyColumnWidthPx: 48,
  tooltipMinWidthPx: 56,
  tooltipClampWidthPx: 80,
  tooltipHeightPx: 28,
  tooltipOffsetPx: 16,
  endpointRadiusPx: 4.5,
  hoverPointRadiusPx: 3.5,
  endpointMergeDistancePx: 8,
  lyricMinWidthPx: 16,
  noteLaneHeightPx: 24,
} as const;

export const VOLUME_EDITOR_LINE_WIDTH = {
  volume: 2,
  hoveredVolume: 2,
  endpoint: 2,
  tooltipGuide: 1,
} as const;
