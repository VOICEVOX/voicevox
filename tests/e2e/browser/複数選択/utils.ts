import { Page } from "@playwright/test";

export async function addAudioCells(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await page.getByRole("button", { name: "テキストを追加" }).click();
    await page.waitForTimeout(100);
  }
}

export const ctrlLike = process.platform === "darwin" ? "Meta" : "Control";
