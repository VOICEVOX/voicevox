import { shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AllDialog from "@/components/Dialog/AllDialog.vue";
import InitialSettingsDialog from "@/components/Dialog/InitialSettingsDialog/Container.vue";
import UpdateNotificationDialogContainer from "@/components/Dialog/UpdateNotificationDialog/Container.vue";

const { storeState } = vi.hoisted(() => ({
  storeState: {
    isAcceptTermsDialogOpen: false,
    isOldCharacterOrderDialogOpen: false,
    isOldDefaultStyleSelectDialogOpen: false,
    isAcceptRetrieveTelemetryDialogOpen: false,
    isInitialSettingsDialogOpen: true,
  },
}));

vi.mock("@/store", () => ({
  useStore: () => ({
    state: storeState,
    getters: {
      GET_ORDERED_ALL_CHARACTER_INFOS: [],
    },
    actions: {
      SET_DIALOG_OPEN: vi.fn(),
    },
  }),
}));

describe("AllDialog", () => {
  beforeEach(() => {
    Object.assign(storeState, {
      isAcceptTermsDialogOpen: false,
      isOldCharacterOrderDialogOpen: false,
      isOldDefaultStyleSelectDialogOpen: false,
      isAcceptRetrieveTelemetryDialogOpen: false,
      isInitialSettingsDialogOpen: true,
    });
  });

  it.each([
    "isAcceptTermsDialogOpen",
    "isOldCharacterOrderDialogOpen",
    "isOldDefaultStyleSelectDialogOpen",
    "isAcceptRetrieveTelemetryDialogOpen",
  ] as const)("%sの表示中は初期設定を表示しない", (dialogState) => {
    storeState[dialogState] = true;

    const wrapper = shallowMount(AllDialog, {
      props: { isEnginesReady: true },
    });

    expect(
      wrapper.findComponent(InitialSettingsDialog).props("canOpenDialog"),
    ).toBe(false);
  });

  it("先行するダイアログが閉じると初期設定を表示できる", () => {
    const wrapper = shallowMount(AllDialog, {
      props: { isEnginesReady: true },
    });

    expect(
      wrapper.findComponent(InitialSettingsDialog).props("canOpenDialog"),
    ).toBe(true);
  });

  it("初期設定の表示中はアップデート通知を表示しない", () => {
    const wrapper = shallowMount(AllDialog, {
      props: { isEnginesReady: true },
    });

    expect(
      wrapper
        .findComponent(UpdateNotificationDialogContainer)
        .props("canOpenDialog"),
    ).toBe(false);
  });

  it("初期設定が閉じていてエンジンの準備が完了するとアップデート通知を表示できる", () => {
    storeState.isInitialSettingsDialogOpen = false;

    const wrapper = shallowMount(AllDialog, {
      props: { isEnginesReady: true },
    });

    expect(
      wrapper
        .findComponent(UpdateNotificationDialogContainer)
        .props("canOpenDialog"),
    ).toBe(true);
  });
});
