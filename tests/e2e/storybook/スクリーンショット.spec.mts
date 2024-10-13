import { test, expect } from "@playwright/test";

type StorybookIndex = {
  v: 5;
  entries: Record<string, StorybookEntry>;
};
type StorybookEntry = {
  type: string;
  id: string;
  name: string;
  title: string;
  tags: string[];
};

// テスト対象のStory一覧を取得する。
// play-fnが付いているStoryはUnit Test用Storyとみなしてスクリーンショットを撮らない
const getStoriesToTest = (index: StorybookIndex) =>
  Object.values(index.entries).filter(
    (entry) => entry.type === "story" && !entry.tags.includes("play-fn"),
  );

const index = (await fetch("http://localhost:7357/index.json").then((res) =>
  res.json(),
)) as StorybookIndex;

const currentStories = getStoriesToTest(index);

const storyIds = currentStories.map((entry) => entry.id);

for (const story of storyIds) {
  test(`スクリーンショット：${story}`, async ({ page }) => {
    test.skip(process.platform !== "win32", "Windows以外のためスキップします");

    await page.goto(`http://localhost:7357/iframe.html?id=${story}`);
    const body = page.locator("body.sb-show-main");
    await body.waitFor({ state: "visible" });
    await expect(page).toHaveScreenshot(`${story}.png`, { fullPage: true });
  });
}
