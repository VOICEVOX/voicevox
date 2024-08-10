import { test, expect } from "@playwright/test";
import { gotoHome } from "../navigators";

test.beforeEach(gotoHome);

test("起動したら「利用規約に関するお知らせ」が表示される", async ({ page }) => {
  await expect(page.getByText("利用規約に関するお知らせ")).toBeVisible({
    timeout: 90 * 1000,
  });
});

test("利用規約同意前に各種UIが無効になっている", async ({ page }) => {
  await expect(page.getByText("利用規約に関するお知らせ")).toBeVisible({
    timeout: 90 * 1000,
  });

  // ソングボタン
  const songButton = page.getByText("ソング");
  await expect(songButton).toBeVisible();
  await expect(songButton).toBeDisabled();
});
