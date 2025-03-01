import { Locator, Page } from "@playwright/test";
import { ensureNotNullish } from "@/helpers/errorHelper";

/**
 * 最新のquasarダイアログのlocatorを取得する
 */
export function getNewestQuasarDialog(page: Page) {
  const locator = page.locator('[id^="q-portal--dialog"]');
  return locator.last();
}

/**
 * quasarのメニューのlocatorを取得する
 */
export function getQuasarMenu(page: Page, menuName: string) {
  return page.getByRole("listitem").filter({ hasText: menuName });
}

/** Locator の配列を x 座標でソートする */
export async function fetchLocatorsSortedByX(
  locators: Locator[],
): Promise<Locator[]> {
  const locatorsWithPosition = await Promise.all(
    locators.map(async (locator) => ({
      locator,
      x: ensureNotNullish(await locator.boundingBox()).x,
    })),
  );
  locatorsWithPosition.sort((a, b) => a.x - b.x);
  return locatorsWithPosition.map(({ locator }) => locator);
}
