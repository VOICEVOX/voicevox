export type ToolPaletteLayout =
  | "proposalA"
  | "proposalB"
  | "proposalC"
  | "proposalD"
  | "proposalE"
  | "proposalF"
  | "proposalG"
  | "proposalH"
  | "proposalI"
  | "proposalJ"
  | "dock"
  | "dockCenter"
  | "rail"
  | "center"
  | "centerBottom"
  | "side"
  | "reservedRail";

export const TOOL_PALETTE_LAYOUT_OPTIONS: {
  value: ToolPaletteLayout;
  label: string;
}[] = [
  { value: "dock", label: "Dock - inline" },
  { value: "dockCenter", label: "Dock - center" },
  { value: "rail", label: "Rail - inline" },
  { value: "centerBottom", label: "Rail - Center bottom" },
  { value: "side", label: "Rail - Side" },
  { value: "reservedRail", label: "Rail - Reserved" },
];
