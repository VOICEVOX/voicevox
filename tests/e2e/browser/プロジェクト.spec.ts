import fs from "node:fs/promises";
import { test, expect } from "@playwright/test";

import { gotoHome, navigateToMain } from "../navigators";
import {
  collectAllAudioCellContents,
  loadProject,
  waitForUiUnlock,
} from "./utils";

test.beforeEach(gotoHome);

test("プロジェクトを読み込める", async ({ page }) => {
  await navigateToMain(page);
  const content = await fs.readFile(
    `${import.meta.dirname}/vvproj/simple.vvproj`,
    "utf-8",
  );
  await loadProject(page, content);
  await waitForUiUnlock(page);
  expect(await collectAllAudioCellContents(page)).toEqual([
    "hoge",
    "fuga",
    "piyo",
  ]);
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
