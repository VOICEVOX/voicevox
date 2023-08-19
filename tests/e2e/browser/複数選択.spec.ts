import { test, expect, Page } from "@playwright/test";
import { toggleSetting, navigateToMain } from "../navigators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);

  await navigateToMain(page);
  await page.waitForTimeout(100);
  await toggleSetting(page, "複数選択");

  await addAudioCells(page, 3);
});

const ctrlLike = process.platform === "darwin" ? "Meta" : "Control";
/**
 * アクティブなAudioCellと選択されているAudioCellを取得する。
 * 戻り値のインデックスは1から始まる。（nth-childのインデックスと揃えるため）
 */
async function getSelectedStatus(page: Page): Promise<{
  active: number;
  selected: number[];
}> {
  const selectedAudioKeys = await page.evaluate(() => {
    const audioCells = [...document.querySelectorAll(".audio-cell")];
    let active: number | undefined;
    const selected: number[] = [];
    for (let i = 0; i < audioCells.length; i++) {
      const audioCell = audioCells[i];
      if (audioCell.classList.contains("active")) {
        active = i + 1;
      }
      if (audioCell.classList.contains("selected")) {
        selected.push(i + 1);
      }
    }
    if (active === undefined) {
      throw new Error("No active audio cell");
    }

    return { active, selected };
  });
  return selectedAudioKeys;
}

async function addAudioCells(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await page.getByRole("button", { name: "テキストを追加" }).click();
    await page.waitForTimeout(100);
  }
}

test("複数選択：マウス周り", async ({ page }) => {
  // Shift+クリックは前回選択していたAudioCellから今回クリックしたAudioCellまでを選択する
  await page.locator(".audio-cell:nth-child(2)").click();
  await page.keyboard.down("Shift");
  await page.locator(".audio-cell:nth-child(4)").click();
  await page.keyboard.up("Shift");

  await page.waitForTimeout(100);
  const selectedStatus1 = await getSelectedStatus(page);
  expect(selectedStatus1.active).toBe(4);
  expect(selectedStatus1.selected).toEqual([2, 3, 4]);

  // ただのクリックはactiveAudioKeyとselectedAudioKeysをクリックしたAudioCellだけにする
  await page.locator(".audio-cell:nth-child(2)").click();

  await page.waitForTimeout(100);
  const selectedStatus2 = await getSelectedStatus(page);
  expect(selectedStatus2.active).toBe(2);
  expect(selectedStatus2.selected).toEqual([2]);

  // Ctrl+クリックは選択範囲を追加する
  await page.keyboard.down(ctrlLike);
  await page.locator(".audio-cell:nth-child(4)").click();
  await page.keyboard.up(ctrlLike);
  await page.waitForTimeout(100);

  const selectedStatus3 = await getSelectedStatus(page);
  expect(selectedStatus3.active).toBe(4);
  expect(selectedStatus3.selected).toEqual([2, 4]);

  // Ctrl+クリックは選択範囲から削除する
  await page.keyboard.down(ctrlLike);
  await page.locator(".audio-cell:nth-child(2)").click();
  await page.keyboard.up(ctrlLike);
  await page.waitForTimeout(100);

  const selectedStatus4 = await getSelectedStatus(page);
  expect(selectedStatus4.active).toBe(4);
  expect(selectedStatus4.selected).toEqual([4]);

  // activeのAudioCellをCtrl+クリックすると選択範囲から削除して次のselectedのAudioCellをactiveにする
  await page.keyboard.down(ctrlLike);
  await page.locator(".audio-cell:nth-child(2)").click();
  await page.locator(".audio-cell:nth-child(2)").click();
  await page.keyboard.up(ctrlLike);
  await page.waitForTimeout(100);

  const selectedStatus5 = await getSelectedStatus(page);
  expect(selectedStatus5.active).toBe(4);
  expect(selectedStatus5.selected).toEqual([4]);
});

test("複数選択：キーボード", async ({ page }) => {
  // Shift+下で下方向を選択範囲にする
  await page.locator(".audio-cell:nth-child(2)").click();
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.up("Shift");
  await page.waitForTimeout(100);

  const selectedStatus1 = await getSelectedStatus(page);
  expect(selectedStatus1.active).toBe(3);
  expect(selectedStatus1.selected).toEqual([2, 3]);

  // ただの下で下方向をactiveにして他の選択を解除する
  await page.keyboard.press("ArrowDown");

  await page.waitForTimeout(100);
  const selectedStatus2 = await getSelectedStatus(page);
  expect(selectedStatus2.active).toBe(4);
  expect(selectedStatus2.selected).toEqual([4]);

  // Shift+上で上方向を選択範囲にする
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.up("Shift");
  await page.waitForTimeout(100);

  const selectedStatus3 = await getSelectedStatus(page);
  expect(selectedStatus3.active).toBe(3);
  expect(selectedStatus3.selected).toEqual([3, 4]);

  // ただの上で上方向をactiveにして他の選択を解除する
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(100);

  const selectedStatus4 = await getSelectedStatus(page);
  expect(selectedStatus4.active).toBe(2);
  expect(selectedStatus4.selected).toEqual([2]);
});
