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
  | "globalRail"
  | "sectionedRail"
  | "zoneHeader"
  | "selectionContextBar"
  | "markingMenu"
  | "dock"
  | "dockCenter"
  | "rail"
  | "center"
  | "centerBottom"
  | "side"
  | "sideLeft"
  | "sideRight"
  | "sideLeftToolbarRight"
  | "reservedRail"
  | "reservedRailHeaderTools";

export const TOOL_PALETTE_LAYOUT_OPTIONS: {
  value: ToolPaletteLayout;
  label: string;
}[] = [
  { value: "globalRail", label: "A - Global rail" },
  { value: "sectionedRail", label: "B - Sectioned rail" },
  { value: "zoneHeader", label: "C - Zone headers" },
  { value: "selectionContextBar", label: "E - Context bar" },
  { value: "markingMenu", label: "F - Marking menu" },
  { value: "dock", label: "Dock - inline" },
  { value: "dockCenter", label: "Dock - center" },
  { value: "rail", label: "Rail - inline" },
  { value: "centerBottom", label: "Rail - Center bottom" },
  { value: "sideLeft", label: "Rail - Left side" },
  { value: "sideLeftToolbarRight", label: "Rail - Left rail, right tools" },
  { value: "sideRight", label: "Rail - Right side" },
  { value: "reservedRail", label: "Rail - Reserved" },
  { value: "reservedRailHeaderTools", label: "Rail - Header tools" },
];
