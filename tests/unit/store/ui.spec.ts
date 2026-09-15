import { beforeEach, expect, test } from "vitest";
import { store } from "@/store";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";

const initialState = cloneWithUnwrapProxy(store.state);

beforeEach(() => {
  store.replaceState(cloneWithUnwrapProxy(initialState));
});

test("初期設定ダイアログを開閉するとUIとメニューバーのロック状態も変わる", async () => {
  expect(store.state.isInitialSettingsDialogOpen).toBe(false);

  await store.actions.SET_DIALOG_OPEN({
    isInitialSettingsDialogOpen: true,
  });

  expect(store.state.isInitialSettingsDialogOpen).toBe(true);
  expect(store.getters.UI_LOCKED).toBe(true);
  expect(store.getters.MENUBAR_LOCKED).toBe(true);
  expect(store.state.uiLockCount).toBe(1);
  expect(store.state.dialogLockCount).toBe(1);

  await store.actions.SET_DIALOG_OPEN({
    isInitialSettingsDialogOpen: true,
  });

  expect(store.state.uiLockCount).toBe(1);
  expect(store.state.dialogLockCount).toBe(1);

  await store.actions.SET_DIALOG_OPEN({
    isInitialSettingsDialogOpen: false,
  });

  expect(store.state.isInitialSettingsDialogOpen).toBe(false);
  expect(store.getters.UI_LOCKED).toBe(false);
  expect(store.getters.MENUBAR_LOCKED).toBe(false);
  expect(store.state.uiLockCount).toBe(0);
  expect(store.state.dialogLockCount).toBe(0);
});
