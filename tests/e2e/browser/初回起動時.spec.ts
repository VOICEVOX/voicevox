import { test, expect } from "@playwright/test";
import { gotoHome } from "../navigators";

test.beforeEach(gotoHome);

test("起動したら利用規約ダイアログと利用規約内容が表示される", async ({
  page,
}) => {
  await expect(page.getByText("利用規約に関するお知らせ")).toBeVisible({
    timeout: 90 * 1000,
  });

  await test.step("利用規約の内容が表示されていることを確認", async () => {
    await expect(page.getByText("ダミー利用規約")).toBeVisible();
  });
});

test("利用規約同意前に各種UIが無効になっている", async ({ page }) => {
  await expect(page.getByText("利用規約に関するお知らせ")).toBeVisible({
    timeout: 90 * 1000,
  });

  // ソングボタン
  const songButton = page.getByRole("toolbar").getByText("ソング");
  await expect(songButton).toBeVisible();
  await expect(songButton).toBeDisabled();
});
