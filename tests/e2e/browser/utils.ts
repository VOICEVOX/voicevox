import { test, type Page, type Locator, expect } from "@playwright/test";
import { getQuasarMenu } from "../locators";
import {
  mockReadFile,
  mockShowOpenFileDialog,
  mockShowSaveFileDialog,
  mockWriteFile,
} from "./mockUtility";
import { assertNonNullable } from "@/type/utility";

/** UIのロックが解除されるまで待つ */
export async function waitForUiUnlock(page: Page): Promise<void> {
  await test.step("UIのロックが解除されるまで待つ", async () => {
    const addAudioButton = page.getByLabel("テキストを追加");
    await expect(addAudioButton).toBeEnabled({ timeout: 10 * 1000 });
  });
}

/**
 * ページ内でプロジェクトを読み込む。
 *
 * @param projectJson 読み込むプロジェクトファイルの内容
 */
export async function loadProject(
  page: Page,
  projectJson: string,
): Promise<void> {
  await test.step("プロジェクトを読み込む", async () => {
    const testProjPath = `/tmp/${Date.now()}-testProj.vvproj`;
    await mockReadFile(page, testProjPath, Buffer.from(projectJson, "utf-8"));
    await mockShowOpenFileDialog(page, testProjPath);
    await page.getByRole("button", { name: "ファイル" }).click();
    await getQuasarMenu(page, "プロジェクトを読み込む").click();

    // TODO: 編集中の内容を保存するか問うダイアログに対応する
  });
}

/**
 * プロジェクトを保存する。
 *
 * @returns 保存されたプロジェクトファイルの内容
 */
export async function saveProject(page: Page): Promise<string> {
  return await test.step("プロジェクトを保存する", async () => {
    const writeFileHandle = await mockWriteFile(page);
    const saveFileDialogHandle = await mockShowSaveFileDialog(page);
    await page.getByRole("button", { name: "ファイル" }).click();
    await getQuasarMenu(page, "プロジェクトの複製を保存").click();
    await waitForUiUnlock(page);
    const [fileId] = await saveFileDialogHandle.getFileIds();
    assertNonNullable(fileId);
    const writtenFiles = await writeFileHandle.getWrittenFileBuffers();
    const writtenFile = writtenFiles[fileId];
    assertNonNullable(writtenFile);
    return writtenFile.toString("utf-8");
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
      await page
        .getByRole("textbox", { name: `${i + 1}行目`, exact: true })
        .inputValue(),
    );
  }
  return results;
}

/** AudioCellの入力欄にテキストを入力する */
export async function fillAudioCell(page: Page, index: number, text: string) {
  const locator = page.locator(".audio-cell input").nth(index);
  await locator.fill(text);
  await locator.press("Enter");
  await page.waitForTimeout(100);
  await validateInput(locator, text);
}

/** input要素の値が期待通りか検証する */
export async function validateInput(locator: Locator, expectedText: string) {
  expect(await locator.inputValue()).toBe(expectedText);
}
