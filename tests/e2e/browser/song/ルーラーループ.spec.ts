import { test, expect } from "@playwright/test";

import { gotoHome, navigateToSong } from "../../navigators";
import { ensureNotNullish } from "@/helpers/errorHelper";

test.beforeEach(gotoHome);

test("ループ範囲をドラッグして追加できる", async ({ page }) => {
  await navigateToSong(page);

  const loopLane = page.locator(".sequencer-ruler-loop .loop-lane");
  const loopRange = loopLane.locator(".loop-range");

  await test.step("初期状態ではループが存在しない", async () => {
    await expect(loopRange).toHaveCount(0);
  });

  await test.step("ドラッグしてループを追加する", async () => {
    const startPos = { x: 100, y: 5 };
    const endPos = { x: 200, y: 5 };
    await loopLane.hover({ position: startPos });
    await page.mouse.down();
    await page.mouse.move(endPos.x, endPos.y);
    await page.mouse.up();
  });

  await test.step("ループが追加される", async () => {
    await expect(loopRange).toHaveCount(1);
    const loopBox = ensureNotNullish(await loopRange.first().boundingBox());
    expect(loopBox.width).toBeGreaterThanOrEqual(50); // スナップ考慮しても50pxはあるはず
  });
});

// NOTE: 他に追加したいものとして
// クリックでのループON/OFF
// ドラッグ距離0とダブルクリックでのループ範囲の削除
// 左右ハンドル(start/end)の入れ替え
