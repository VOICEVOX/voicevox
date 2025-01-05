import {
  getDefaultHotkeySettings,
  hotkeyActionNameSchema,
} from "@/domain/hotkeyAction";

test("すべてのホットキーに初期値が設定されている", async () => {
  const defaultHotkeySettings = getDefaultHotkeySettings({ isMac: false });
  const allActionNames = new Set(hotkeyActionNameSchema.options);
  const defaultHotkeyActionsNames = new Set(
    defaultHotkeySettings.map((setting) => setting.action),
  );
  expect(allActionNames).toEqual(defaultHotkeyActionsNames);
});
