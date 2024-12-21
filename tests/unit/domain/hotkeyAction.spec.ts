import {
  defaultHotkeySettings,
  hotkeyActionNameSchema,
} from "@/domain/hotkeyAction";

test("すべてのホットキーに初期値が設定されている", async () => {
  const allActionNames = new Set(hotkeyActionNameSchema.options);
  const actionsNames = new Set(
    defaultHotkeySettings.map((setting) => setting.action),
  );
  expect(actionsNames).toEqual(allActionNames);
});
