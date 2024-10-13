import { test, expect } from "@playwright/test";
import { stories } from "./storyIds.generated";
import { StorybookIndex, getStoriesToTest } from "./generateStoryIds";

test("スクリーンショット：一覧確認", async () => {
  const index = (await fetch("http://localhost:7357/index.json").then((res) =>
    res.json(),
  )) as StorybookIndex;

  const currentStories = getStoriesToTest(index);

  const storyIds = currentStories.map((entry) => entry.id);
  const newStories = storyIds.filter((id) => !stories.includes(id));

  expect(
    newStories,
    "新規追加されたStoryがあります。npm run test:storybook-vrt-update を実行してください。",
  ).toEqual([]);
});

for (const story of stories) {
  test(`スクリーンショット：${story}`, async ({ page }) => {
    test.skip(process.platform !== "win32", "Windows以外のためスキップします");

    await page.goto(`http://localhost:7357/iframe.html?id=${story}`);
    const body = page.locator("body.sb-show-main");
    await body.waitFor({ state: "visible" });
    await expect(page).toHaveScreenshot(`${story}.png`, { fullPage: true });
  });
}
