import { test, expect } from "@playwright/test";
import { gotoHome } from "../navigators";

test.beforeEach(gotoHome);

test("起動したら「利用規約に関するお知らせ」が表示される", async ({ page }) => {
  await expect(page.getByText("利用規約に関するお知らせ")).toBeVisible({
    timeout: 60 * 1000,
  });
});
