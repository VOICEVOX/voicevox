import fs from "node:fs/promises";
import { test, expect } from "@playwright/test";

import { gotoHome, navigateToMain } from "../navigators";
import {
  collectAllAudioCellContents,
  fillAudioCell,
  loadProject,
  saveProject,
  waitForUiUnlock,
} from "./utils";

test.beforeEach(gotoHome);

test("過去のプロジェクトを読み込める", async ({ page }) => {
  await navigateToMain(page);
  const projectJson = await fs.readFile(
    `${import.meta.dirname}/vvproj/0.14.11.vvproj`,
    "utf-8",
  );
  const textContent = await fs.readFile(
    `${import.meta.dirname}/vvproj/0.14.11.txt`,
    "utf-8",
  );
  await loadProject(page, projectJson);
  await waitForUiUnlock(page);
  expect(await collectAllAudioCellContents(page)).toEqual(
    textContent.split("\n").filter((line) => line.length > 0),
  );
});

test("プロジェクトを保存して読み込み直せる", async ({ page }) => {
  const savedProject =
    await test.step("AudioCellにテキストを入れて保存", async () => {
      await navigateToMain(page);

      await page.getByRole("button").filter({ hasText: "add" }).click();
      await page.getByRole("button").filter({ hasText: "add" }).click();
      await fillAudioCell(page, 0, "hoge");
      await fillAudioCell(page, 1, "fuga");
      await fillAudioCell(page, 2, "piyo");
      expect(await collectAllAudioCellContents(page)).toEqual([
        "hoge",
        "fuga",
        "piyo",
      ]);

      return await saveProject(page);
    });

  await test.step("保存したプロジェクトを読み込み直す", async () => {
    await page.reload();
    await gotoHome({ page });

    await loadProject(page, savedProject);
    await waitForUiUnlock(page);
    expect(await collectAllAudioCellContents(page)).toEqual([
      "hoge",
      "fuga",
      "piyo",
    ]);
  });
});

test("未来のバージョンのプロジェクトを読み込むと警告を出す", async ({
  page,
}) => {
  await navigateToMain(page);
  const content = await fs.readFile(
    `${import.meta.dirname}/vvproj/future.vvproj`,
    "utf-8",
  );
  await loadProject(page, content);
  await expect(
    page.getByText(
      "プロジェクトファイルが新しいバージョンのVOICEVOXで作成されています",
    ),
  ).toBeVisible();
});
