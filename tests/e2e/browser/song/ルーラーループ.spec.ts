import { test, expect } from "@playwright/test";

import { gotoHome, navigateToSong } from "../../navigators";
import { ensureNotNullish } from "@/type/utility";

test.beforeEach(gotoHome);

test("ループ範囲をドラッグして追加できる", async ({ page }) => {
  await navigateToSong(page);

  // レーンの親要素を取得
  const loopLane = page.locator(".sequencer-ruler-loop .loop-lane");

  // 初期状態ではループが存在しないことを確認
  const initialLoopRange = loopLane.locator(".loop-range");
  await expect(initialLoopRange).toHaveCount(0);

  const startPos = { x: 100, y: 5 };
  const endPos = { x: 200, y: 5 };

  // ドラッグをエミュレート startPos から endPos までドラッグ
  await loopLane.hover({ position: startPos });
  await page.mouse.down();
  await page.mouse.move(endPos.x, endPos.y);
  await page.mouse.up();

  // ループが追加されたことを確認
  const loopRange = loopLane.locator(".loop-range");
  await expect(loopRange).toHaveCount(1);

  // 追加されたループの長さが適切か確認
  const loopBox = ensureNotNullish(await loopRange.first().boundingBox());
  expect(loopBox.width).toBeGreaterThanOrEqual(50); // スナップ考慮しても50pxはあるはず...
});

// NOTE: 他に追加したいものとして
// クリックでのループON/OFF
// ドラッグ距離0とダブルクリックでのループ範囲の削除
// 左右ハンドル(start/end)の入れ替え
