import { test, expect, type Page } from "@playwright/test";
import { navigateToMain, gotoHome } from "../../navigators";
import { ctrlLike, addAudioCells } from "./utils";

test.beforeEach(async ({ page }) => {
  await gotoHome({ page });

  await navigateToMain(page);
  await page.waitForTimeout(100);

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

  await test.step("activeのAudioCellをクリックしても何も起こらない", async () => {
    await page.locator(".audio-cell:nth-child(1)").click();
    await page.waitForTimeout(100);
    selectedStatus = await getSelectedStatus(page);
    expect(selectedStatus.active).toBe(1);
    expect(selectedStatus.selected).toEqual([1]);
  });

  await test.step("Shift+クリックで前回選択から今回選択まで範囲選択する", async () => {
    await page.locator(".audio-cell:nth-child(2)").click();
    await page.keyboard.down("Shift");
    await page.locator(".audio-cell:nth-child(4)").click();
    await page.keyboard.up("Shift");
    await page.waitForTimeout(100);
    selectedStatus = await getSelectedStatus(page);
    expect(selectedStatus.active).toBe(4);
    expect(selectedStatus.selected).toEqual([2, 3, 4]);
  });

  await test.step("ただのクリックは単一選択になる", async () => {
    await page.locator(".audio-cell:nth-child(2)").click();
    await page.waitForTimeout(100);
    selectedStatus = await getSelectedStatus(page);
    expect(selectedStatus.active).toBe(2);
    expect(selectedStatus.selected).toEqual([2]);
  });

  if (process.platform === "darwin" && !!process.env.CI) {
    // なぜかCmd(Meta)+クリックが動かないのでスキップする
    // FIXME: 動くようにする
    return;
  }

  await test.step("Ctrl+クリックで選択範囲を追加する", async () => {
    await page.keyboard.down(ctrlLike);
    await page.locator(".audio-cell:nth-child(4)").click();
    await page.keyboard.up(ctrlLike);
    await page.waitForTimeout(100);
    selectedStatus = await getSelectedStatus(page);
    expect(selectedStatus.active).toBe(4);
    expect(selectedStatus.selected).toEqual([2, 4]);
  });

  await test.step("Ctrl+クリックで選択範囲から削除する", async () => {
    await page.keyboard.down(ctrlLike);
    await page.locator(".audio-cell:nth-child(2)").click();
    await page.keyboard.up(ctrlLike);
    await page.waitForTimeout(100);
    selectedStatus = await getSelectedStatus(page);
    expect(selectedStatus.active).toBe(4);
    expect(selectedStatus.selected).toEqual([4]);
  });

  await test.step("activeをCtrl+クリックで削除すると次のselectedがactiveになる", async () => {
    await page.keyboard.down(ctrlLike);
    await page.locator(".audio-cell:nth-child(2)").click();
    await page.locator(".audio-cell:nth-child(2)").click();
    await page.keyboard.up(ctrlLike);
    await page.waitForTimeout(100);
    selectedStatus = await getSelectedStatus(page);
    expect(selectedStatus.active).toBe(4);
    expect(selectedStatus.selected).toEqual([4]);
  });

  await test.step("selected内のCharacterButtonをクリックしても選択範囲は変わらない", async () => {
    await page.locator(".audio-cell:nth-child(2)").click();
    await page.keyboard.down("Shift");
    await page.locator(".audio-cell:nth-child(4)").click();
    await page.keyboard.up("Shift");
    await page.locator(".audio-cell:nth-child(2) .character-button").click();
    await page.waitForTimeout(100);
    selectedStatus = await getSelectedStatus(page);
    expect(selectedStatus.active).toBe(4);
    expect(selectedStatus.selected).toEqual([2, 3, 4]);
  });

  await test.step("selected外をクリックすると単一選択になる", async () => {
    await page.locator(".audio-cell:nth-child(1)").click();
    await page.waitForTimeout(100);
    selectedStatus = await getSelectedStatus(page);
    expect(selectedStatus.active).toBe(1);
    expect(selectedStatus.selected).toEqual([1]);
  });
});

test("複数選択：キーボード", async ({ page }) => {
  let selectedStatus: SelectedStatus;

  await test.step("Shift+下で下方向を選択範囲にする", async () => {
    await page.locator(".audio-cell:nth-child(2)").click();
    await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.up("Shift");
    await page.waitForTimeout(100);
    selectedStatus = await getSelectedStatus(page);
    expect(selectedStatus.active).toBe(3);
    expect(selectedStatus.selected).toEqual([2, 3]);
  });

  await test.step("ただの下で下方向をactiveにして他の選択を解除する", async () => {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(100);
    selectedStatus = await getSelectedStatus(page);
    expect(selectedStatus.active).toBe(4);
    expect(selectedStatus.selected).toEqual([4]);
  });

  await test.step("Shift+上で上方向を選択範囲にする", async () => {
    await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.up("Shift");
    await page.waitForTimeout(100);
    selectedStatus = await getSelectedStatus(page);
    expect(selectedStatus.active).toBe(2);
    expect(selectedStatus.selected).toEqual([2, 3, 4]);
  });

  await test.step("ただの上で上方向をactiveにして他の選択を解除する", async () => {
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(100);
    selectedStatus = await getSelectedStatus(page);
    expect(selectedStatus.active).toBe(1);
    expect(selectedStatus.selected).toEqual([1]);
  });

  await test.step("Shift+下で下方向を選択範囲にする（2回目）", async () => {
    await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.up("Shift");
    await page.waitForTimeout(100);
    selectedStatus = await getSelectedStatus(page);
    expect(selectedStatus.active).toBe(3);
    expect(selectedStatus.selected).toEqual([1, 2, 3]);
  });

  await test.step("ただの下で下方向をactiveにして他の選択を解除する（2回目）", async () => {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(100);
    selectedStatus = await getSelectedStatus(page);
    expect(selectedStatus.active).toBe(4);
    expect(selectedStatus.selected).toEqual([4]);
  });

  await test.step("Enterでテキストフィールドにフォーカスし複数選択を解除する", async () => {
    await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.up("Shift");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
    selectedStatus = await getSelectedStatus(page);
    expect(selectedStatus.active).toBe(3);
    expect(selectedStatus.selected).toEqual([3]);
  });
});

test("複数選択：台本欄の余白クリックで解除", async ({ page }) => {
  let selectedStatus: SelectedStatus;

  await test.step("複数選択する", async () => {
    await page.locator(".audio-cell:nth-child(2)").click();
    await page.keyboard.down("Shift");
    await page.locator(".audio-cell:nth-child(4)").click();
    await page.keyboard.up("Shift");
    await page.waitForTimeout(100);
    selectedStatus = await getSelectedStatus(page);
    expect(selectedStatus.active).toBe(4);
    expect(selectedStatus.selected).toEqual([2, 3, 4]);
  });

  await test.step("台本欄の余白クリックで単一選択に戻る", async () => {
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
});
