import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/components/App.vue";
import type { EditorType } from "@/type/preload";

const { store, hotkeyManager } = vi.hoisted(() => ({
  store: {
    state: {
      openedEditor: undefined as EditorType | undefined,
      acceptRetrieveTelemetry: "Accepted",
      acceptTerms: "Accepted",
      editorFont: "default",
      availableThemes: [{ name: "Default" }],
      currentTheme: "Default",
      isVuexReady: true,
      savingSetting: {
        audioOutputDevice: "default",
      },
      hotkeySettings: [],
      engineInfos: {},
      engineIds: [],
    },
    actions: {
      INIT_VUEX: vi.fn(),
      PULL_AND_INIT_ENGINE_INFOS: vi.fn(),
      SET_IS_MULTI_ENGINE_OFF_MODE: vi.fn(),
      LOAD_USER_CHARACTER_ORDER: vi.fn(),
      POST_ENGINE_START: vi.fn(),
      SYNC_ALL_USER_DICT: vi.fn(),
      SET_DIALOG_OPEN: vi.fn(),
      GET_INITIAL_PROJECT_FILE_PATH: vi.fn(),
      APPLY_DEVICE_ID_TO_AUDIO_CONTEXT: vi.fn(),
    },
  },
  hotkeyManager: {
    load: vi.fn(),
    onEditorChange: vi.fn(),
  },
}));

vi.mock("@/store", () => ({
  useStore: () => store,
}));

vi.mock("@/plugins/hotkeyPlugin", () => ({
  useHotkeyManager: () => ({ hotkeyManager }),
}));

vi.mock("@gtm-support/vue-gtm", () => ({
  useGtm: () => undefined,
}));

vi.mock("@/components/Menu/MenuBar/useCommonMenuBarData", () => ({
  useCommonMenuBarData: () => [],
}));

vi.mock("@/components/Talk/menuBarData", () => ({
  useMenuBarData: () => [],
}));

vi.mock("@/components/Sing/menuBarData", () => ({
  useMenuBarData: () => [],
}));

vi.mock("@/backend/electron/renderer/menuBarData", () => ({
  useElectronMenuBarData: () => [],
}));

vi.mock("@/domain/dom", () => ({
  setFontToCss: vi.fn(),
  setThemeToCss: vi.fn(),
}));

vi.mock("@/components/Menu/MenuBar/MenuBar.vue", () => ({
  default: {
    name: "MenuBar",
    template: '<div data-testid="menu-bar" />',
  },
}));

vi.mock("@/components/Talk/TalkEditor.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("@/components/Sing/SingEditor.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("@/components/Dialog/AllDialog.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("@/components/ErrorBoundary.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("reka-ui", () => ({
  TooltipProvider: { template: "<div><slot /></div>" },
}));

describe("App", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    store.state.openedEditor = undefined;
    store.actions.PULL_AND_INIT_ENGINE_INFOS.mockResolvedValue(undefined);
    store.actions.LOAD_USER_CHARACTER_ORDER.mockResolvedValue(undefined);
    store.actions.POST_ENGINE_START.mockResolvedValue({
      success: true,
      anyNewCharacters: false,
    });
    store.actions.SYNC_ALL_USER_DICT.mockResolvedValue(undefined);
    store.actions.SET_DIALOG_OPEN.mockResolvedValue(undefined);
    store.actions.GET_INITIAL_PROJECT_FILE_PATH.mockResolvedValue(undefined);
  });

  it.each<{
    openedEditor: EditorType | undefined;
    shouldOpen: boolean;
  }>([
    { openedEditor: undefined, shouldOpen: true },
    { openedEditor: "talk", shouldOpen: false },
    { openedEditor: "song", shouldOpen: false },
  ])(
    "openedEditorが$openedEditorのとき初期設定のopen状態を$shouldOpenにする",
    async ({ openedEditor, shouldOpen }) => {
      store.actions.INIT_VUEX.mockImplementationOnce(() => {
        store.state.openedEditor = openedEditor;
      });

      mount(App);
      await flushPromises();

      expect(store.actions.SET_DIALOG_OPEN).toHaveBeenCalledExactlyOnceWith({
        isAcceptRetrieveTelemetryDialogOpen: false,
        isAcceptTermsDialogOpen: false,
        isInitialSettingsDialogOpen: shouldOpen,
      });
    },
  );

  it("エディタが未選択でもタイトルバーを表示する", async () => {
    store.actions.INIT_VUEX.mockImplementationOnce(() => {
      store.state.openedEditor = undefined;
    });

    const wrapper = mount(App);
    await flushPromises();

    expect(wrapper.find('[data-testid="menu-bar"]').exists()).toBe(true);
  });
});
