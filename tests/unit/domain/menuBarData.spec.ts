import { describe, test, expect } from "vitest";
import { concatMenuBarData } from "@/components/Menu/MenuBar/menuBarData";
import { MenuItemData } from "@/components/Menu/type";

const menuItemData1: MenuItemData = {
  type: "button",
  label: "音声書き出し",
  onClick: () => {},
  disableWhenUiLocked: true,
};
const menuItemData2: MenuItemData = {
  type: "button",
  label: "選択音声を書き出し",
  onClick: () => {},
  disableWhenUiLocked: true,
};
const menuItemData3: MenuItemData = {
  type: "button",
  label: "プロジェクトをインポート",
  onClick: () => {},
  disableWhenUiLocked: true,
};
describe("concatMenuBarData", () => {
  test("MenuItemDataを割り当てる", () => {
    expect(
      concatMenuBarData([
        {
          file: {
            audioExport: [menuItemData1],
          },
        },
      ]),
    ).toMatchObject({
      file: [menuItemData1],
    });
  });

  test("Separatorを入れる", () => {
    expect(
      concatMenuBarData([
        {
          file: {
            audioExport: [menuItemData1],
            externalProject: [menuItemData3],
          },
        },
      ]),
    ).toMatchObject({
      file: [menuItemData1, { type: "separator" }, menuItemData3],
    });
  });

  test("複数場所にまたがったMenuItemDataを結合する", () => {
    expect(
      concatMenuBarData([
        {
          file: {
            audioExport: [menuItemData1],
          },
        },
        {
          file: {
            audioExport: [menuItemData2],
            externalProject: [menuItemData3],
          },
        },
      ]),
    ).toMatchObject({
      file: [
        menuItemData1,
        menuItemData2,
        { type: "separator" },
        menuItemData3,
      ],
    });
  });
});
