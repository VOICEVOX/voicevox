import { Page } from "@playwright/test";

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
