export type MenuItemBase<T extends string> = {
  type: T;
  label?: string;
};

export type MenuItemSeparator = MenuItemBase<"separator">;

export type MenuItemRoot = MenuItemBase<"root"> & {
  onClick?: () => void;
  subMenu: MenuItemData[];
  icon?: string;
  disabled?: boolean;
  disableWhenUiLocked: boolean;
  disablreloadingLocked?: boolean;
};

export type MenuItemButton = MenuItemBase<"button"> & {
  onClick: () => void;
  icon?: string;
  disabled?: boolean;
  disableWhenUiLocked: boolean;
  disablreloadingLocked?: boolean;
};

export type MenuItemData = MenuItemSeparator | MenuItemRoot | MenuItemButton;

export type MenuItemType = MenuItemData["type"];
