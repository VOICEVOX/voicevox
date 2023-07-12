const menuTemplateForMac: Electron.MenuItemConstructorOptions[] = [
  {
    label: "VOICEVOX",
    submenu: [{ role: "quit" }],
  },
  {
    label: "Edit",
    submenu: [
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  },
];

const menuTemplateView: Electron.MenuItemConstructorOptions = {
  label: "View",
  submenu: [
    { role: "zoomIn" },
    { role: "zoomOut" },
  ],
};

/**
 * electron用のメニューのテンプレートを生成する
 */
export function generateMenuTemplate({ isMac }: { isMac: boolean }) {
  const menuTemplate = isMac
    ? [...menuTemplateForMac, menuTemplateView]
    : [menuTemplateView];
  return menuTemplate;
}
