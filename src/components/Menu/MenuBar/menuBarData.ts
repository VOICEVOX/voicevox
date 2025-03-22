import { MaybeRef, ComputedRef, unref } from "vue";
import { MenuItemData } from "@/components/Menu/type";
import { flatWithSeparator } from "@/helpers/arrayHelper";
import {
  mapObjectValues,
  objectEntries,
  objectFromEntries,
} from "@/helpers/typedEntries";

type MenuBarCategory = "file" | "edit" | "view" | "engine" | "setting";

const menuItemStructure = {
  file: ["audioExport", "externalProject", "project"],
  edit: ["undoRedo", "copyPaste", "select", "misc"],
  view: ["guide", "portrait", "window"],
  engine: ["singleEngine", "allEngines"],
  setting: ["subOptions", "options"],
} as const satisfies Record<MenuBarCategory, string[]>;

type MenuItemSection = (typeof menuItemStructure)[MenuBarCategory][number];

export type MenuBarContent = Partial<{
  [K in MenuBarCategory]: Partial<
    Record<(typeof menuItemStructure)[K][number], MenuItemData[]>
  >;
}>;
export type MaybeComputedMenuBarContent = Partial<{
  [K in MenuBarCategory]: ComputedRef<MenuBarContent[K]> | MenuBarContent[K];
}>;

export const concatMenuBarData = (
  menuBarContents: MaybeRef<MaybeComputedMenuBarContent>[],
): Record<keyof MenuBarContent, MenuItemData[]> => {
  const result = mapObjectValues(menuItemStructure, (category, contents) => {
    const singleMenuCategoryItems = concatSingleMenuBarCategory(
      category,
      menuBarContents,
    );

    return flatWithSeparator(
      contents
        .map((menuItemKey) => singleMenuCategoryItems[menuItemKey])
        .filter((v) => v.length > 0),
      { type: "separator" },
    );
  });

  return result;
};

const concatSingleMenuBarCategory = (
  key: MenuBarCategory,
  menuBarContents: MaybeRef<MaybeComputedMenuBarContent>[],
) => {
  const sectionItems: Record<MenuItemSection, MenuItemData[]> =
    objectFromEntries(menuItemStructure[key].map((v) => [v, []]));

  for (const menuBarContent of menuBarContents) {
    const items = unref(unref(menuBarContent)[key]);
    if (items) {
      for (const [section, sectionMenuItems] of objectEntries(items)) {
        // @ts-expect-error 型が合わないので無視する。
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        sectionItems[section].push(...sectionMenuItems);
      }
    }
  }

  return sectionItems;
};
