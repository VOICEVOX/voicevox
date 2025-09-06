import { test, Page } from "@playwright/test";
import { getQuasarMenu } from "../locators";
import { mockReadFile, mockShowOpenFileDialog } from "./mockUtility";

/** UIのロックが解除されるまで待つ */
export async function waitForUiUnlock(page: Page): Promise<void> {
  await test.step("UIのロックが解除されるまで待つ", async () => {
    const addAudioButton = page.getByLabel("テキストを追加");
    await test.expect(addAudioButton).toBeEnabled({ timeout: 10 * 1000 });
  });
}

/** プロジェクトを読み込む。 */
export async function loadProject(page: Page, proj: string): Promise<void> {
  await test.step("プロジェクトを読み込む", async () => {
    const testProjPath = `/tmp/${Date.now()}-testProj.vvproj`;
    await mockReadFile(page, testProjPath, Buffer.from(proj, "utf-8"));
    await mockShowOpenFileDialog(page, testProjPath);
    await page.getByRole("button", { name: "ファイル" }).click();
    await getQuasarMenu(page, "プロジェクトを読み込む").click();
  });
}

/** すべてのAudioCellに入力されているテキストを配列で取得する */
export async function collectAllAudioCellContents(
  page: Page,
): Promise<string[]> {
  const count = await page.locator(".audio-cell").count();
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(
      await page.getByRole("textbox", { name: `${i + 1}行目` }).inputValue(),
    );
  }
  return results;
}
