import { test, expect, Page } from "@playwright/test";
import { navigateToMain } from "../navigators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});

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

    return { active, selected };
  });
  if (selectedAudioKeys.active === undefined) {
    throw new Error("No active audio cell");
  }
  // return selectedAudioKeys; だと何故か型エラーを出すので、一旦オブジェクトを作って返す
  // FIXME: なんとかする
  return {
    active: selectedAudioKeys.active,
    selected: selectedAudioKeys.selected,
  };
}

async function prepareAudioCells(page: Page, count: number) {
  for (let i = 1; i < count; i++) {
    await page.getByRole("button", { name: "テキストを追加" }).click();
    await page.waitForTimeout(100);
  }
}

test("複数選択：ただのクリックはactiveAudioKeyとselectedAudioKeysをクリックしたAudioCellだけにする", async ({
  page,
}) => {
  await navigateToMain(page);
  await page.waitForTimeout(100);

  await prepareAudioCells(page, 4);

  await page.locator(".audio-cell:nth-child(2)").click();

  await page.waitForTimeout(100);
  const selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(2);
  expect(selectedStatus.selected).toEqual([2]);
});

test("複数選択：Shift+クリックは前回選択していたAudioCellから今回クリックしたAudioCellまでを選択する", async ({
  page,
}) => {
  await navigateToMain(page);
  await page.waitForTimeout(100);

  await prepareAudioCells(page, 4);

  await page.locator(".audio-cell:nth-child(2)").click();
  await page.locator(".audio-cell:nth-child(4)").click({
    modifiers: ["Shift"],
  });

  await page.waitForTimeout(100);
  const selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(4);
  expect(selectedStatus.selected).toEqual([2, 3, 4]);
});

test("複数選択：選択してないAudioCellをCtrl+クリックすると選択範囲を追加する", async ({
  page,
}) => {
  if (process.platform === "darwin") {
    // FIXME: Macでは動かないので、Macでは落ちるテストとしてマークする。
    test.fail();
  }
  await navigateToMain(page);
  await page.waitForTimeout(100);

  await prepareAudioCells(page, 4);

  await page.locator(".audio-cell:nth-child(2)").click();
  await page.locator(".audio-cell:nth-child(4)").click({
    modifiers: [process.platform === "darwin" ? "Meta" : "Control"],
  });

  await page.waitForTimeout(100);
  const selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(4);
  expect(selectedStatus.selected).toEqual([2, 4]);
});

test("複数選択：選択してるAudioCellをCtrl+クリックすると選択範囲から削除する", async ({
  page,
}) => {
  if (process.platform === "darwin") {
    // FIXME: Macでは動かないので、Macでは落ちるテストとしてマークする。
    test.fail();
  }
  await navigateToMain(page);
  await page.waitForTimeout(100);

  await prepareAudioCells(page, 4);

  await page.locator(".audio-cell:nth-child(2)").click();
  await page.locator(".audio-cell:nth-child(4)").click({
    modifiers: ["Shift"],
  });
  await page.locator(".audio-cell:nth-child(3)").click({
    modifiers: [process.platform === "darwin" ? "Meta" : "Control"],
  });

  await page.waitForTimeout(100);
  const selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(4);
  expect(selectedStatus.selected).toEqual([2, 4]);
});
