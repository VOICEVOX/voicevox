import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import MenuBar from "@/components/Menu/MenuBar/MenuBar.vue";
import MenuButton from "@/components/Menu/MenuButton.vue";
import TitleBarButtons from "@/components/Menu/MenuBar/TitleBarButtons.vue";
import TitleBarEditorSwitcher from "@/components/Menu/MenuBar/TitleBarEditorSwitcher.vue";
import type { MenuBarCategory } from "@/components/Menu/MenuBar/menuBarData";
import type { MenuItemData } from "@/components/Menu/type";
import type { EditorType } from "@/type/preload";

vi.mock("quasar", () => ({
  QBar: { template: "<div><slot /></div>" },
  QSpace: { template: "<div />" },
  useQuasar: () => ({
    platform: { is: { mac: false } },
  }),
}));

vi.mock("@/domain/appInfo", () => ({
  getAppInfos: () => ({ version: "999.999.999" }),
}));

vi.mock("@/store", () => ({
  useStore: () => ({
    state: {
      altPortInfos: {},
      engineInfos: {},
      isMultiEngineOffMode: false,
    },
    getters: {
      UI_LOCKED: false,
      MENUBAR_LOCKED: false,
      PROJECT_NAME: undefined,
      IS_EDITED: false,
      IS_FULLSCREEN: false,
    },
    actions: {
      SET_DIALOG_OPEN: vi.fn(),
    },
  }),
}));

const subMenuData: Record<MenuBarCategory, MenuItemData[]> = {
  file: [],
  edit: [],
  view: [],
  engine: [],
  setting: [],
};

describe("MenuBar", () => {
  it("エディタが未選択のときはウィンドウ操作だけを表示する", () => {
    const wrapper = mount(MenuBar, {
      props: {
        subMenuData,
        editor: undefined,
      },
      global: {
        stubs: {
          MenuButton: true,
          TitleBarButtons: true,
          TitleBarEditorSwitcher: true,
        },
      },
    });

    expect(wrapper.findAllComponents(MenuButton)).toHaveLength(0);
    expect(wrapper.findComponent(TitleBarEditorSwitcher).exists()).toBe(false);
    expect(wrapper.findComponent(TitleBarButtons).exists()).toBe(true);
  });

  it.each<EditorType>(["talk", "song"])(
    "%sの選択後はメニューとエディタ切替を表示する",
    (editor) => {
      const wrapper = mount(MenuBar, {
        props: {
          subMenuData,
          editor,
        },
        global: {
          stubs: {
            MenuButton: true,
            TitleBarButtons: true,
            TitleBarEditorSwitcher: true,
          },
        },
      });

      expect(wrapper.findAllComponents(MenuButton)).toHaveLength(6);
      expect(wrapper.findComponent(TitleBarEditorSwitcher).exists()).toBe(true);
      expect(wrapper.findComponent(TitleBarButtons).exists()).toBe(true);
    },
  );
});
