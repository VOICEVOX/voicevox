import { Page } from "@playwright/test";

/**
 * 最新のquasarダイアログのlocaltorを取得する
 */
export function getNewestQuasarDialog(page: Page) {
  const locator = page.locator('[id^="q-portal--dialog"]');
  return locator.last();
}
