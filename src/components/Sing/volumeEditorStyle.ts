import { Color } from "@/sing/graphics/lineStrip";

export const VOLUME_EDITOR_LAYOUT = {
  keyColumnWidthPx: 48,
  tooltipWidthPx: 84,
  tooltipHeightPx: 34,
  tooltipOffsetPx: 10,
  tooltipPaddingPx: 4,
  denseGridLabelMinHeightPx: 120,
  sparseGridLabelMinHeightPx: 80,
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
} as const;

export const VOLUME_LINE_COLORS = {
  originalLight: new Color(156, 158, 156, 191),
  originalDark: new Color(114, 116, 114, 191),
  editedLight: new Color(0, 167, 63, 209),
  editedDark: new Color(95, 188, 117, 209),
} as const;

export const VOLUME_GRAPHICS_COLORS = {
  horizontalLineLight: 0xadadad,
  horizontalLineDark: 0x585858,
  tooltipGuideLight: 0x4f4f4f,
  tooltipGuideDark: 0xb8b8b8,
  erasePreviewOverlay: 0x000000,
} as const;
