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
  | "sideLeft"
  | "sideRight"
  | "sideLeftToolbarRight"
  | "reservedRail";

export const TOOL_PALETTE_LAYOUT_OPTIONS: {
  value: ToolPaletteLayout;
  label: string;
}[] = [
  { value: "dock", label: "Dock - inline" },
  { value: "dockCenter", label: "Dock - center" },
  { value: "rail", label: "Rail - inline" },
  { value: "centerBottom", label: "Rail - Center bottom" },
  { value: "sideLeft", label: "Rail - Left side" },
  { value: "sideLeftToolbarRight", label: "Rail - Left rail, right tools" },
  { value: "sideRight", label: "Rail - Right side" },
  { value: "reservedRail", label: "Rail - Reserved" },
];
