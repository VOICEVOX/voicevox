import { Menu, MenuItem } from "electron";

const MENU_ROOT_ITEM_ENGINE_ID = "engine";
const MENU_SUBMENU_ITEM_LAUNCHMODE_ID = "launchMode";
const MENU_SUBMENU_CHILD_CPU_ID = "cpu";
const MENU_SUBMENU_CHILD_GPU_ID = "gpu";

type BuiltMenu = {
  instance: Menu;
  setActiveLaunchMode: (useGpu: boolean) => void;
};

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

const createMenu = () => {
  // 外部から設定するCallback
  let onLaunchModeItemClickedImpl: (useGpu: boolean) => void;

  // Callback Wrapper
  const onLaunchModeItemClicked = (item: MenuItem) => {
    const useGpu = item.id === MENU_SUBMENU_CHILD_GPU_ID;
    onLaunchModeItemClickedImpl?.(useGpu);
  };

  type ElectronMenuTemplate = Parameters<typeof Menu.buildFromTemplate>[0];

  const menuTemplate: ElectronMenuTemplate = [
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
    setOnLaunchModeItemClicked: (cb: (useGpu: boolean) => void) =>
      (onLaunchModeItemClickedImpl = cb),
    setActiveLaunchMode,
  };
};

class MenuBuilderImpl {
  private readonly _menu: ReturnType<typeof createMenu>;

  constructor() {
    this._menu = createMenu();
  }

  setOnLaunchModeItemClicked(cb: (useGpu: boolean) => void): MenuBuilderImpl {
    this._menu.setOnLaunchModeItemClicked(cb);
    return this;
  }

  build(): BuiltMenu {
    return {
      instance: this._menu.menuInstance,
      setActiveLaunchMode: this._menu.setActiveLaunchMode,
    };
  }
}

const _menuBuilder = new MenuBuilderImpl();
export const MenuBuilder = (): MenuBuilderImpl => _menuBuilder;
