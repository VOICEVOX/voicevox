import { test, expect } from "@playwright/test";

import { gotoHome, navigateToMain } from "../navigators";
import { locateQSplitterElements } from "./utils";
import { ensureNotNullish } from "@/type/utility";

test.beforeEach(gotoHome);

test("イントネーション調整欄を縦に広げられる", async ({ page }) => {
  await navigateToMain(page);

  const { handle: separatorHandle } = locateQSplitterElements(
    page.locator(".q-splitter--horizontal").first(),
  );
  const detailPane = page.getByTestId("audio-detail");

  await test.step("イントネーション調整欄を表示する", async () => {
    const input = page.getByRole("textbox", { name: "1行目" });
    await input.fill("こんにちは");
    await input.press("Enter");
    await page.getByText("ｲﾝﾄﾈｰｼｮﾝ", { exact: true }).click();
    await expect(detailPane.locator(".pitch-cell").first()).toBeVisible();
  });

  const initialHeight = await test.step("調整欄の高さを取得する", async () => {
    const box = ensureNotNullish(await detailPane.boundingBox());
    return box.height;
  });

  await test.step("境界を上へドラッグすると調整欄が広がる", async () => {
    const box = ensureNotNullish(await separatorHandle.boundingBox());

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 100, { steps: 10 });
    await page.mouse.up();

    const resizedBox = ensureNotNullish(await detailPane.boundingBox());
    expect(resizedBox.height).toBeGreaterThan(initialHeight);
  });
});
