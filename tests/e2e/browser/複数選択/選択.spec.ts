import { test, expect, Page } from "@playwright/test";
import { toggleSetting, navigateToMain, gotoHome } from "../../navigators";
import { ctrlLike, addAudioCells } from "./utils";

test.beforeEach(async ({ page }) => {
  await gotoHome({ page });

  await navigateToMain(page);
  await page.waitForTimeout(100);
  await toggleSetting(page, "複数選択");

  await addAudioCells(page, 3);
});

type SelectedStatus = {
  active: number;
  selected: number[];
};
/**
 * アクティブなAudioCellと選択されているAudioCellを取得する。
 * 戻り値のインデックスは1から始まる。（nth-childのインデックスと揃えるため）
 */
async function getSelectedStatus(page: Page): Promise<SelectedStatus> {
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
    if (active == undefined) {
      throw new Error("No active audio cell");
    }

    return { active, selected };
  });
  return selectedAudioKeys;
}

test("複数選択：マウス周り", async ({ page }) => {
  let selectedStatus: SelectedStatus;

  // 複数選択していない状態でactiveのAudioCellをクリックしても何も起こらない
  await page.locator(".audio-cell:nth-child(1)").click();

  await page.waitForTimeout(100);
  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(1);
  expect(selectedStatus.selected).toEqual([1]);

  // Shift+クリックは前回選択していたAudioCellから今回クリックしたAudioCellまでを選択する
  await page.locator(".audio-cell:nth-child(2)").click();
  await page.keyboard.down("Shift");
  await page.locator(".audio-cell:nth-child(4)").click();
  await page.keyboard.up("Shift");

  await page.waitForTimeout(100);
  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(4);
  expect(selectedStatus.selected).toEqual([2, 3, 4]);

  // ただのクリックはactiveAudioKeyとselectedAudioKeysをクリックしたAudioCellだけにする
  await page.locator(".audio-cell:nth-child(2)").click();

  await page.waitForTimeout(100);
  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(2);
  expect(selectedStatus.selected).toEqual([2]);

  if (process.platform === "darwin" && !!process.env.CI) {
    // なぜかCmd(Meta)+クリックが動かないのでスキップする
    // FIXME: 動くようにする
    return;
  }

  // Ctrl+クリックは選択範囲を追加する
  await page.keyboard.down(ctrlLike);
  await page.locator(".audio-cell:nth-child(4)").click();
  await page.keyboard.up(ctrlLike);
  await page.waitForTimeout(100);

  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(4);
  expect(selectedStatus.selected).toEqual([2, 4]);

  // Ctrl+クリックは選択範囲から削除する
  await page.keyboard.down(ctrlLike);
  await page.locator(".audio-cell:nth-child(2)").click();
  await page.keyboard.up(ctrlLike);
  await page.waitForTimeout(100);

  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(4);
  expect(selectedStatus.selected).toEqual([4]);

  // activeのAudioCellをCtrl+クリックすると選択範囲から削除して次のselectedのAudioCellをactiveにする
  await page.keyboard.down(ctrlLike);
  await page.locator(".audio-cell:nth-child(2)").click();
  await page.locator(".audio-cell:nth-child(2)").click();
  await page.keyboard.up(ctrlLike);
  await page.waitForTimeout(100);

  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(4);
  expect(selectedStatus.selected).toEqual([4]);

  // selected内のCharacterButtonをクリックしても選択範囲は変わらない
  await page.locator(".audio-cell:nth-child(2)").click();
  await page.keyboard.down("Shift");
  await page.locator(".audio-cell:nth-child(4)").click();
  await page.keyboard.up("Shift");

  await page.locator(".audio-cell:nth-child(2) .character-button").click();

  await page.waitForTimeout(100);
  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(4);
  expect(selectedStatus.selected).toEqual([2, 3, 4]);

  // selected外のCharacterButtonをクリックすると選択範囲をそのAudioCellだけにする
  await page.locator(".audio-cell:nth-child(1)").click();

  await page.waitForTimeout(100);
  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(1);
  expect(selectedStatus.selected).toEqual([1]);
});

test("複数選択：キーボード", async ({ page }) => {
  let selectedStatus: SelectedStatus;
  // Shift+下で下方向を選択範囲にする
  await page.locator(".audio-cell:nth-child(2)").click();
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.up("Shift");
  await page.waitForTimeout(100);

  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(3);
  expect(selectedStatus.selected).toEqual([2, 3]);

  // ただの下で下方向をactiveにして他の選択を解除する
  await page.keyboard.press("ArrowDown");

  await page.waitForTimeout(100);
  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(4);
  expect(selectedStatus.selected).toEqual([4]);

  // Shift+上で上方向を選択範囲にする
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.up("Shift");
  await page.waitForTimeout(100);

  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(2);
  expect(selectedStatus.selected).toEqual([2, 3, 4]);

  // ただの上で上方向をactiveにして他の選択を解除する
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(100);

  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(1);
  expect(selectedStatus.selected).toEqual([1]);

  // Shift+下で下方向を選択範囲にする
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.up("Shift");
  await page.waitForTimeout(100);

  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(3);
  expect(selectedStatus.selected).toEqual([1, 2, 3]);

  // ただの下で下方向をactiveにして他の選択を解除する

  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);

  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(4);
  expect(selectedStatus.selected).toEqual([4]);

  // EnterでactiveのAudioCellのテキストフィールドにフォーカスし、複数選択を解除する

  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.up("Shift");
  await page.keyboard.press("Enter");

  await page.waitForTimeout(100);

  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(3);
  expect(selectedStatus.selected).toEqual([3]);
});

test("複数選択：台本欄の余白クリックで解除", async ({ page }) => {
  let selectedStatus: SelectedStatus;

  await page.locator(".audio-cell:nth-child(2)").click();
  await page.keyboard.down("Shift");
  await page.locator(".audio-cell:nth-child(4)").click();
  await page.keyboard.up("Shift");

  // 念のため確認
  await page.waitForTimeout(100);
  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(4);
  expect(selectedStatus.selected).toEqual([2, 3, 4]);

  const scriptArea = page.locator(".audio-cell-pane");
  const boundingBox = await scriptArea.boundingBox();
  if (!boundingBox) {
    throw new Error("No bounding box");
  }
  await scriptArea.click({
    position: {
      x: 10,
      y: boundingBox.height - 10,
    },
  });

  await page.waitForTimeout(100);
  selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(4);
  expect(selectedStatus.selected).toEqual([4]);
});
