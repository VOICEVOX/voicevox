export type ParameterPanelLayoutMode = "single" | "stack";

export type VolumeEditValueMode = "absolute" | "relative";

export type ReferenceOverlayMode = "none" | "waveform";

export const PARAMETER_PANEL_LAYOUT_OPTIONS: {
  value: ParameterPanelLayoutMode;
  label: string;
}[] = [
  { value: "single", label: "Single" },
  { value: "stack", label: "Stack" },
];

export const VOLUME_EDIT_VALUE_MODE_OPTIONS: {
  value: VolumeEditValueMode;
  label: string;
}[] = [
  { value: "absolute", label: "Absolute" },
  { value: "relative", label: "Relative +/-12 dB" },
];

export const REFERENCE_OVERLAY_MODE_OPTIONS: {
  value: ReferenceOverlayMode;
  label: string;
}[] = [
  { value: "none", label: "None" },
  { value: "waveform", label: "Waveform overlay" },
];
