import { test, expect } from "@playwright/test";

import { gotoHome, navigateToSong } from "../../navigators";
import { getQuasarMenu } from "../../locators";
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
  const laneBox = ensureNotNullish(await loopLane.boundingBox());
  await page.mouse.move(laneBox.x + endPos.x, laneBox.y + endPos.y);
  await expect(loopLane.locator(".loop-range")).toHaveCount(1);
  await expect
    .poll(
      async () =>
        ensureNotNullish(await loopLane.locator(".loop-range").boundingBox())
          .width,
    )
    .toBeGreaterThanOrEqual(50);
  await page.mouse.up();

  // ループが追加されたことを確認
  const loopRange = loopLane.locator(".loop-range");
  await expect(loopRange).toHaveCount(1);

  // 追加されたループの長さが適切か確認
  const loopBox = ensureNotNullish(await loopRange.first().boundingBox());
  expect(loopBox.width).toBeGreaterThanOrEqual(50); // スナップ考慮しても50pxはあるはず...
});

test("ルーラーの高さに応じた右クリックメニューが表示される", async ({
  page,
}) => {
  await navigateToSong(page);
  const ruler = page.locator(".sequencer-ruler");

  for (const y of [5, 16, 19, 20, 30, 39]) {
    await test.step(`高さ${y}pxで適切なメニューが表示される`, async () => {
      await ruler.click({ button: "right", position: { x: 160, y } });
      if (y < 20) {
        await expect(getQuasarMenu(page, "ループ範囲を作成")).toBeVisible();
        await expect(getQuasarMenu(page, "テンポ変化を挿入")).toBeHidden();
      } else {
        await expect(getQuasarMenu(page, "テンポ変化を挿入")).toBeVisible();
        await expect(getQuasarMenu(page, "拍子変化を挿入")).toBeVisible();
        await expect(getQuasarMenu(page, "ループ範囲を作成")).toBeHidden();
      }
      await expect(getQuasarMenu(page, "コピー")).toBeHidden();
      await expect(getQuasarMenu(page, "クオンタイズ")).toBeHidden();
      await page.keyboard.press("Escape");
    });
  }
});

test("中央の高さで両方のループハンドルをドラッグできる", async ({ page }) => {
  await navigateToSong(page);
  const ruler = page.locator(".sequencer-ruler");
  const handles = ruler.locator(".loop-handle-drag-area");

  await test.step("右クリック位置にループを作成する", async () => {
    await ruler.click({ button: "right", position: { x: 100, y: 16 } });
    await getQuasarMenu(page, "ループ範囲を作成").click();
    await expect(ruler.locator(".loop-range")).toHaveCount(1);
    const start = ensureNotNullish(await handles.nth(0).boundingBox());
    const rulerBox = ensureNotNullish(await ruler.boundingBox());
    expect(start.x - rulerBox.x).toBeGreaterThan(50);
  });

  for (const index of [0, 1]) {
    await test.step(`${index === 0 ? "開始" : "終了"}ハンドルを中央の高さで移動する`, async () => {
      const handle = handles.nth(index);
      const other = handles.nth(1 - index);
      const before = ensureNotNullish(await handle.boundingBox());
      const otherBefore = ensureNotNullish(await other.boundingBox());
      const rulerBox = ensureNotNullish(await ruler.boundingBox());
      await ruler.click({
        button: "right",
        position: { x: before.x + 6 - rulerBox.x, y: 16 },
      });
      await expect(getQuasarMenu(page, "ループ範囲を削除")).toBeVisible();
      await expect(getQuasarMenu(page, "コピー")).toBeHidden();
      await page.keyboard.press("Escape");
      await page.mouse.move(before.x + 6, rulerBox.y + 16);
      await page.mouse.down();
      await page.mouse.move(before.x + 6 + 40, rulerBox.y + 16, { steps: 5 });
      await expect
        .poll(async () => ensureNotNullish(await handle.boundingBox()).x)
        .toBeGreaterThan(before.x + 20);
      const preview = ensureNotNullish(await handle.boundingBox());
      await page.mouse.up();
      await expect
        .poll(async () => ensureNotNullish(await handle.boundingBox()).x)
        .toBe(preview.x);
      expect(ensureNotNullish(await other.boundingBox()).x).toBe(otherBefore.x);
      await expect(ruler.locator(".loop-lane")).not.toHaveClass(/is-dragging/);
    });
  }
});

test("ルーラーの左クリックの既存動作を維持する", async ({ page }) => {
  await navigateToSong(page);
  const ruler = page.locator(".sequencer-ruler");
  const sequencer = page.getByLabel("シーケンサ");
  const playhead = page.getByTestId("sequencer-playhead");

  await test.step("ノートを追加する", async () => {
    await sequencer.click({ position: { x: 100, y: 171 } });
    await expect(sequencer.locator(".note")).toHaveCount(1);
  });

  for (const y of [16, 30]) {
    await test.step(`高さ${y}pxの空白をクリックすると再生位置が移動し選択が解除される`, async () => {
      await sequencer.locator(".note-bar").first().click();
      await expect(sequencer.locator(".note").first()).toHaveClass(/selected/);
      const before = ensureNotNullish(await playhead.boundingBox());
      await ruler.click({ position: { x: y === 16 ? 200 : 300, y } });
      await expect
        .poll(async () => ensureNotNullish(await playhead.boundingBox()).x)
        .not.toBe(before.x);
      await expect(sequencer.locator(".note").first()).not.toHaveClass(
        /selected/,
      );
      await expect(page.getByRole("listitem")).toHaveCount(0);
    });
  }

  await test.step("拍子・テンポの文字を左クリックすると編集メニューが表示される", async () => {
    await ruler.locator(".value-changes-lane-value-change").first().click();
    await expect(getQuasarMenu(page, "テンポ変化を編集")).toBeVisible();
    await expect(getQuasarMenu(page, "拍子変化を編集")).toBeVisible();
    await page.keyboard.press("Escape");
  });

  await test.step("ループ範囲の左クリックで有効・無効を切り替える", async () => {
    await ruler.click({ button: "right", position: { x: 100, y: 5 } });
    await getQuasarMenu(page, "ループ範囲を作成").click();
    const lane = ruler.locator(".loop-lane");
    await expect(lane).not.toHaveClass(/is-enabled/);
    await ruler.locator(".loop-range-drag-area").click();
    await expect(lane).toHaveClass(/is-enabled/);
    await ruler.locator(".loop-range-drag-area").click();
    await expect(lane).not.toHaveClass(/is-enabled/);
  });
});

// NOTE: 他に追加したいものとして
// ドラッグ距離0とダブルクリックでのループ範囲の削除
// 左右ハンドル(start/end)の入れ替え
