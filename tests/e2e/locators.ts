import { Page } from "@playwright/test";

/**
 * 最新のquasarダイアログのlocaltorを取得する
 */
export function getNewestQuasarDialog(page: Page) {
  const locator = page.locator('[id^="q-portal--dialog"]');
  return locator.last();
}

/**
 * quasarのメニューのlocaltorを取得する
 */
export function getQuasarMenu(page: Page, menuName: string) {
  return page.getByRole("listitem").filter({ hasText: menuName });
}
