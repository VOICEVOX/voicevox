import { Menu } from "electron";
import { ContextMenuType } from "@/type/contextMenu";

export const contextMenu: Record<ContextMenuType, Menu> = {
  TEXT_EDIT: Menu.buildFromTemplate([
    { label: "切り取り", role: "cut" },
    { label: "コピー", role: "copy" },
    { label: "貼り付け", role: "paste" },
    { type: "separator" },
    { label: "全選択", role: "selectAll" },
  ]),
};
