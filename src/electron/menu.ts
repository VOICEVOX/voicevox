import { Menu, MenuItem, MenuItemConstructorOptions } from "electron";

const MENU_ROOT_ITEM_FILE_ID = "file";
const MENU_SUBMENU_ITEM_SAVE_ALL_AUDIO_ID = "saveAllAudio";
const MENU_SUBMENU_ITEM_IMPORT_FROM_FILE_ID = "importFromFile";
const MENU_SUBMENU_ITEM_SAVE_PROJECT_FILE_ID = "saveProjectFile";
const MENU_SUBMENU_ITEM_LOAD_PROJECT_FILE_ID = "loadProjectFile";
const MENU_ROOT_ITEM_ENGINE_ID = "engine";
const MENU_SUBMENU_ITEM_LAUNCHMODE_ID = "launchMode";
const MENU_SUBMENU_CHILD_CPU_ID = "cpu";
const MENU_SUBMENU_CHILD_GPU_ID = "gpu";

type BuiltMenu = {
  instance: Menu;
  setActiveLaunchMode: (useGpu: boolean) => void;
  updateLockMenuItems: (uiLocked: boolean) => void;
};

const lockableMenuIds = [
  MENU_SUBMENU_ITEM_SAVE_ALL_AUDIO_ID,
  MENU_SUBMENU_ITEM_IMPORT_FROM_FILE_ID,
  MENU_SUBMENU_ITEM_SAVE_PROJECT_FILE_ID,
  MENU_SUBMENU_ITEM_LOAD_PROJECT_FILE_ID,
];

const setActiveLaunchMode = (useGpu: boolean) => {
  const applicationMenu = Menu.getApplicationMenu();
  if (applicationMenu === null) {
    return;
  }
  applicationMenu.items.forEach((rootMenu) => {
    if (rootMenu.id !== MENU_ROOT_ITEM_ENGINE_ID) {
      return;
    }
    rootMenu.submenu?.items.forEach((subMenu) => {
      if (subMenu.id !== MENU_SUBMENU_ITEM_LAUNCHMODE_ID) {
        return;
      }
      subMenu.submenu?.items.forEach((launchModeItem) => {
        launchModeItem.checked =
          launchModeItem.id === MENU_SUBMENU_CHILD_GPU_ID ? useGpu : !useGpu;
      });
    });
  });
};

const updateLockMenuItems = (uiLocked: boolean) => {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;
  lockableMenuIds.forEach((id) => {
    const menuItem = menu.getMenuItemById(id);
    if (menuItem) menuItem.enabled = !uiLocked;
  });
};

const createMenu = () => {
  // 外部から設定するCallback
  let onLaunchModeItemClickedImpl: (useGpu: boolean) => void;
  let onSaveAllAudioItemClickedImpl: () => void;
  let onImportFromFileItemClickedImpl: () => void;
  let onSaveProjectFileItemClickedImpl: () => void;
  let onLoadProjectFileItemClickedImpl: () => void;

  // Callback Wrapper
  const onLaunchModeItemClicked = (item: MenuItem) => {
    const useGpu = item.id === MENU_SUBMENU_CHILD_GPU_ID;
    onLaunchModeItemClickedImpl?.(useGpu);
  };
  const onSaveAllAudioItemClicked = () => {
    onSaveAllAudioItemClickedImpl?.();
  };
  const onImportFromFileItemClicked = () => {
    onImportFromFileItemClickedImpl?.();
  };
  const onSaveProjectFileItemClicked = () => {
    onSaveProjectFileItemClickedImpl?.();
  };
  const onLoadProjectFileItemClicked = () => {
    onLoadProjectFileItemClickedImpl?.();
  };

  type ElectronMenuTemplate = Parameters<typeof Menu.buildFromTemplate>[0];

  const menuTemplate: ElectronMenuTemplate = [
    {
      id: MENU_ROOT_ITEM_FILE_ID,
      label: "ファイル",
      submenu: [
        {
          id: MENU_SUBMENU_ITEM_SAVE_ALL_AUDIO_ID,
          label: "音声書き出し",
          click: onSaveAllAudioItemClicked,
        },
        {
          id: MENU_SUBMENU_ITEM_IMPORT_FROM_FILE_ID,
          label: "テキスト読み込み",
          click: onImportFromFileItemClicked,
        },
        { type: "separator" },
        {
          id: MENU_SUBMENU_ITEM_SAVE_PROJECT_FILE_ID,
          label: "プロジェクト保存",
          click: onSaveProjectFileItemClicked,
        },
        {
          id: MENU_SUBMENU_ITEM_LOAD_PROJECT_FILE_ID,
          label: "プロジェクト読み込み",
          click: onLoadProjectFileItemClicked,
        },
      ],
    },
    {
      id: MENU_ROOT_ITEM_ENGINE_ID,
      label: "エンジン",
      submenu: [
        {
          id: MENU_SUBMENU_ITEM_LAUNCHMODE_ID,
          label: "起動モード",
          submenu: [
            {
              id: MENU_SUBMENU_CHILD_CPU_ID,
              label: "CPU",
              type: "checkbox",
              click: onLaunchModeItemClicked,
            },
            {
              id: MENU_SUBMENU_CHILD_GPU_ID,
              label: "GPU",
              type: "checkbox",
              click: onLaunchModeItemClicked,
            },
          ],
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);

  return {
    menuInstance: menu,
    setOnLaunchModeItemClicked: (cb: (useGpu: boolean) => Promise<void>) =>
      (onLaunchModeItemClickedImpl = cb),
    setOnSaveAllAudioItemClicked: (cb: () => void) =>
      (onSaveAllAudioItemClickedImpl = cb),
    setOnImportFromFileItemClicked: (cb: () => void) =>
      (onImportFromFileItemClickedImpl = cb),
    setOnSaveProjectFileItemClicked: (cb: () => void) =>
      (onSaveProjectFileItemClickedImpl = cb),
    setOnLoadProjectFileItemClicked: (cb: () => void) =>
      (onLoadProjectFileItemClickedImpl = cb),
    setActiveLaunchMode,
    updateLockMenuItems,
  };
};

class MenuBuilderImpl {
  private readonly _menu: ReturnType<typeof createMenu>;

  constructor() {
    this._menu = createMenu();
  }

  configure(isDevelopment: boolean): MenuBuilderImpl {
    if (isDevelopment) {
      const defaultMenuItemOptions: MenuItemConstructorOptions[] = [
        { role: "fileMenu" },
        { role: "editMenu" },
        { role: "viewMenu" },
        { role: "windowMenu" },
      ];
      defaultMenuItemOptions.forEach((option) =>
        this._menu.menuInstance.append(new MenuItem(option))
      );
    }
    return this;
  }

  setOnLaunchModeItemClicked(cb: (useGpu: boolean) => void): MenuBuilderImpl {
    this._menu.setOnLaunchModeItemClicked(cb);
    return this;
  }

  setOnSaveAllAudioItemClicked(cb: () => void): MenuBuilderImpl {
    this._menu.setOnSaveAllAudioItemClicked(cb);
    return this;
  }

  setOnImportFromFileItemClicked(cb: () => void): MenuBuilderImpl {
    this._menu.setOnImportFromFileItemClicked(cb);
    return this;
  }

  setOnSaveProjectFileItemClicked(cb: () => void): MenuBuilderImpl {
    this._menu.setOnSaveProjectFileItemClicked(cb);
    return this;
  }

  setOnLoadProjectFileItemClicked(cb: () => void): MenuBuilderImpl {
    this._menu.setOnLoadProjectFileItemClicked(cb);
    return this;
  }

  build(): BuiltMenu {
    return {
      instance: this._menu.menuInstance,
      setActiveLaunchMode: this._menu.setActiveLaunchMode,
      updateLockMenuItems: this._menu.updateLockMenuItems,
    };
  }
}

const _menuBuilder = new MenuBuilderImpl();
export const MenuBuilder = (): MenuBuilderImpl => _menuBuilder;
