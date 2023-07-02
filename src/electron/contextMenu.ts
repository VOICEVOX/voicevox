import { Menu, MenuItem, MenuItemConstructorOptions } from "electron";
import { ContextMenuActionRecord, ContextMenuType } from "@/type/contextMenu";

type ContextMenuItemConstructorOptions<T> = MenuItemConstructorOptions & {
  label?: T;
};

const defaultMenuItemOptions: Record<
  ContextMenuType,
  MenuItemConstructorOptions[]
> = {
  TEXT_EDIT: [
    {
      label: "切り取り",
      role: "cut",
    },
    {
      label: "コピー",
      role: "copy",
    },
    {
      label: "貼り付け",
      role: "paste",
    },
    {
      type: "separator",
    },
    {
      label: "全選択",
      role: "selectAll",
    },
  ] as ContextMenuItemConstructorOptions<
    ContextMenuActionRecord["TEXT_EDIT"]
  >[],
};

// 右クリックする場所(TEXT_EDITなど)ごとに動作を保持する仕様にしましたが、
// 最後にクリックした場所だけを保存でも良いかもしれません
const menus = new Map<ContextMenuType, Menu>();

const checkOrBuildContextMenu = (menuType: ContextMenuType) => {
  if (menus.has(menuType)) {
    const menu = menus.get(menuType);
    if (menu === undefined) throw new Error("menu is undefined.");
    return menu;
  }

  const menu = Menu.buildFromTemplate(
    defaultMenuItemOptions[menuType].map(
      (menuItemOptions) => new MenuItem(menuItemOptions)
    )
  );
  menus.set(menuType, menu);
  return menu;
};

export const popupContextMenu = (
  menuType: ContextMenuType,
  options?: Electron.PopupOptions
) => {
  checkOrBuildContextMenu(menuType).popup(options);
};
