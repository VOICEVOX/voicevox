export type ContextMenuActionRecord = {
  TEXT_EDIT: "切り取り" | "コピー" | "貼り付け" | "全選択";
};
export type ContextMenuType = keyof ContextMenuActionRecord;

// 新たに追加したい場合はここに & で繋げる
export type ContextMenuAction = ContextMenuActionRecord["TEXT_EDIT"];

// 現在未使用、将来クリック時の動作を変える機能を実装する際に必要になりそうな型
// FIXME: electronからimportができないため、いくつかの型をunknownとしている
export type ContextMenuClickCallback = (
  // 本来はElectron.MenuItem
  menuItem: unknown,
  // 本来はElectron.BrowserWindow
  browserWindow: unknown | undefined,
  event: KeyboardEvent
) => void;

// 現在未使用、将来オプションを変える機能を実装する際に必要になりそうな型
// FIXME: electronからimportができないため、いくつかの型をunknownとしている
export type ContextMenuItemOptions<T extends ContextMenuAction> = {
  id?: string;
  label?: T;
  click?: ContextMenuClickCallback;
  // 本来はElectron.Menu
  submenu?: unknown;
  type?: "normal" | "separator" | "submenu" | "checkbox" | "radio";
  role?:
    | "undo"
    | "redo"
    | "cut"
    | "copy"
    | "paste"
    | "pasteAndMatchStyle"
    | "delete"
    | "selectAll"
    | "reload"
    | "forceReload"
    | "toggleDevTools"
    | "resetZoom"
    | "zoomIn"
    | "zoomOut"
    | "toggleSpellChecker"
    | "togglefullscreen"
    | "window"
    | "minimize"
    | "close"
    | "help"
    | "about"
    | "services"
    | "hide"
    | "hideOthers"
    | "unhide"
    | "quit"
    | "showSubstitutions"
    | "toggleSmartQuotes"
    | "toggleSmartDashes"
    | "toggleTextReplacement"
    | "startSpeaking"
    | "stopSpeaking"
    | "zoom"
    | "front"
    | "appMenu"
    | "fileMenu"
    | "editMenu"
    | "viewMenu"
    | "shareMenu"
    | "recentDocuments"
    | "toggleTabBar"
    | "selectNextTab"
    | "selectPreviousTab"
    | "mergeAllWindows"
    | "clearRecentDocuments"
    | "moveTabToNewWindow"
    | "windowMenu";
  // https://www.electronjs.org/ja/docs/latest/api/accelerator を参照。
  accelerator?: string;
  // 本来はElectron.NativeImage
  icon?: unknown | string;
  sublabel?: string;
  toolTip?: string;
  enabled?: boolean;
  visible?: boolean;
  checked?: boolean;
  registerAccelerator?: boolean;
  // 本来はElectron.sharingItem
  sharingItem?: {
    filePaths?: string[];
    texts?: string[];
    urls?: string[];
  };
  commandId?: boolean;
  menu?: boolean;
};
