// 起動中のStorybookで様々なStoryを表示し、スクリーンショットを撮って比較するVRT。
// テスト自体はend-to-endではないが、Playwrightを使う関係でe2eディレクトリ内でテストしている。
import { test, expect, Locator } from "@playwright/test";
import z from "zod";

// Storybook 8.3.5時点でのindex.jsonのスキーマ。
// もしスキーマが変わってテストが通らなくなった場合は、このスキーマを修正する。
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
type Story = StorybookIndex["entries"][string];

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
  throw new Error(`Storybookのindex.jsonの取得に失敗しました`, {
    cause: e,
  });
}

const currentStories = getStoriesToTest(index);

const allStories: Record<string, Story[]> = {};
for (const story of currentStories) {
  if (!allStories[story.title]) {
    allStories[story.title] = [];
  }
  allStories[story.title].push(story);
}

for (const [story, stories] of Object.entries(allStories)) {
  test.describe(story, () => {
    for (const story of stories) {
      if (story.tags.includes("skip-screenshot")) {
        continue;
      }
      test.describe(story.name, () => {
        for (const [theme, name] of [
          ["light", "ライト"],
          ["dark", "ダーク"],
        ]) {
          test(`テーマ：${name}`, async ({ page }) => {
            test.skip(
              process.platform !== "win32",
              "Windows以外のためスキップします",
            );

            const params = new URLSearchParams();
            params.append("id", story.id);
            params.append("globals", `theme:${theme}`);
            await page.goto(
              `http://localhost:7357/iframe.html?${params.toString()}`,
            );

            // Storybookのroot要素を取得。
            // data-v-appが存在する（＝Vueのアプリケーションのマウントが完了している）かどうかを
            // ロードが完了したかどうかとして扱う。
            const root = page.locator("#storybook-root[data-v-app]");
            const quasarDialogRoot = page.locator(
              "div[id^=q-portal--dialog--]",
            );

            await root.waitFor({ state: "attached" });

            // Quasarのダイアログが存在する場合はダイアログのスクリーンショットを、そうでない場合は#storybook-rootのスクリーンショットを撮る。
            // q-portal-dialogはそのまま撮るとvisible扱いにならずtoHaveScreenshotが失敗するので、
            // 子要素にある実際のダイアログ（.q-dialog__inner）を撮る。
            let elementToScreenshot: Locator;
            if ((await quasarDialogRoot.count()) > 0) {
              const dialog = quasarDialogRoot.locator(".q-dialog__inner");

              elementToScreenshot = dialog;
            } else {
              elementToScreenshot = root;
            }
            await expect(elementToScreenshot).toHaveScreenshot(
              `${story.id}-${theme}.png`,
            );
          });
        }
      });
    }
  });
}
