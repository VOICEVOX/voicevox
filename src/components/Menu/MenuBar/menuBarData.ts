import { MaybeRef, ComputedRef, unref } from "vue";
import { MenuItemData } from "@/components/Menu/type";
import { flatWithSeparator } from "@/helpers/arrayHelper";
import { objectEntries, objectFromEntries } from "@/helpers/typedEntries";

export type MenuBarCategory = "file" | "edit" | "view" | "engine" | "setting";

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
): Record<MenuBarCategory, MenuItemData[]> => {
  return objectFromEntries(
    objectEntries(menuItemStructure).map(([category]) => [
      category,
      concatMenuItemsByCategory(category, menuBarContents),
    ]),
  );
};

function concatMenuItemsByCategory(
  category: MenuBarCategory,
  menuBarContents: MaybeRef<MaybeComputedMenuBarContent>[],
): MenuItemData[] {
  const sectionItems: Record<MenuItemSection, MenuItemData[]> =
    objectFromEntries(
      menuItemStructure[category].map((section) => [section, []]),
    );

  for (const menuBarContent of menuBarContents) {
    const items = unref(unref(menuBarContent)[category]);
    if (!items) continue;

    for (const [section, sectionMenuItems] of objectEntries(items)) {
      // @ts-expect-error 型が合わないので無視する。
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      sectionItems[section].push(...sectionMenuItems);
    }
  }

  const nonEmptyItems = menuItemStructure[category]
    .map((section) => sectionItems[section])
    .filter((items) => items.length > 0);

  return flatWithSeparator(nonEmptyItems, { type: "separator" });
}
