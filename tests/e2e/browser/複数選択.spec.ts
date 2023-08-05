import { test, expect, Page } from "@playwright/test";
import { navigateToMain } from "../navigators";

test.beforeEach(async ({ page }) => {
  const BASE_URL = "http://localhost:5173/#/home";
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(BASE_URL);
});

async function getSelectedStatus(page: Page): Promise<{
  active: number;
  selected: number[];
}> {
  const selectedAudioKeys = await page.evaluate(() => {
    const audioCells = [...document.querySelectorAll(".audio-cells")];
    let active: number | undefined;
    const selected: number[] = [];
    for (let i = 0; i < audioCells.length; i++) {
      const audioCell = audioCells[i];
      if (audioCell.querySelector("i.active-arrow")) {
        active = i;
      }
      if (audioCell.querySelector(".character-button.selected")) {
        selected.push(i);
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

test("複数選択：ただのクリックはactiveAudioKeyとselectedAudioKeysをクリックしたAudioCellだけにする", async ({
  page,
}) => {
  await navigateToMain(page);
  await page.waitForTimeout(100);

  // 4行用意
  for (let i = 1; i < 4; i++) {
    await page.getByRole("button", { name: "テキストを追加" }).click();
    await page.waitForTimeout(100);
  }

  await page.locator(".audio-cells > div:nth-child(1)").click();

  const selectedStatus = await getSelectedStatus(page);
  expect(selectedStatus.active).toBe(0);
  expect(selectedStatus.selected).toEqual([0]);
});
