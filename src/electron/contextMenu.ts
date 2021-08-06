import { Menu } from "electron";

export const textEditContextMenu = Menu.buildFromTemplate([
  { label: "切り取り", role: "cut" },
  { label: "コピー", role: "copy" },
  { label: "貼り付け", role: "paste" },
  { type: "separator" },
  { label: "全選択", role: "selectAll" },
]);

