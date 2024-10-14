// 起動中のStorybookで様々なStoryを表示し、スクリーンショットを撮って比較するVRT。
// テスト自体はend-to-endではないが、Playwrightを使う関係でe2eディレクトリ内でテストしている。
import { test, expect } from "@playwright/test";
import z from "zod";
import { errorToMessage } from "@/helpers/errorHelper";

const storybookIndexSchema = z.object({
  v: z.literal(5),
  entries: z.record(
    z.object({
      type: z.string(),
      id: z.string(),
      name: z.string(),
      title: z.string(),
      tags: z.array(z.string()),
    }),
  ),
});
type StorybookIndex = z.infer<typeof storybookIndexSchema>;

// テスト対象のStory一覧を取得する。
// play-fnが付いているStoryはUnit Test用Storyとみなしてスクリーンショットを撮らない
const getStoriesToTest = (index: StorybookIndex) =>
  Object.values(index.entries).filter(
    (entry) => entry.type === "story" && !entry.tags.includes("play-fn"),
  );

let index: StorybookIndex;

try {
  index = storybookIndexSchema.parse(
    await fetch("http://localhost:7357/index.json").then((res) => res.json()),
  );
} catch (e) {
  throw new Error(
    `Storybookのindex.jsonの取得に失敗しました：${errorToMessage(e)}`,
  );
}

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
