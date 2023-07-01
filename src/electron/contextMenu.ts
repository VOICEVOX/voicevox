import { Menu, MenuItem, MenuItemConstructorOptions } from "electron";
import { ContextMenuType, TextEditContextMenuAction } from "@/type/contextMenu";

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
  ] as ContextMenuItemConstructorOptions<TextEditContextMenuAction>[],
};

// 右クリックする場所(TEXT_EDITなど)ごとに動作を保持する仕様にしましたが、
// 最後にクリックした場所だけを保存でも良いかもしれません
const menus = new Map<ContextMenuType, Menu>();

// 返り値の型は Electron.Menu | undefined ではなく Electron.Menu 確定のはずですがどうすればいいか分かりません
const checkOrBuildContextMenu = (type: ContextMenuType) => {
  if (menus.has(type)) return menus.get(type);

  const menu = Menu.buildFromTemplate(
    defaultMenuItemOptions[type].map(
      (menuItemOptions) => new MenuItem(menuItemOptions)
    )
  );
  menus.set(type, menu);
  return menu;
};

export const popupContextMenu = (
  type: ContextMenuType,
  options?: Electron.PopupOptions
) => {
  checkOrBuildContextMenu(type)?.popup(options);
};
