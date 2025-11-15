import { test, Page, Locator, expect } from "@playwright/test";
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

/** 指定した数のAudioCellを追加する */
export async function addAudioCells(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await page.getByRole("button", { name: "テキストを追加" }).click();
    await page.waitForTimeout(100);
  }
}

/** AudioCellのキャラクターを変更する */
export async function changeAudioCellCharacter(
  page: Page,
  nthChild: number,
  digit: number,
) {
  await test.step(`${nthChild}人目のキャラクターを変更`, async () => {
    const audioCell = page.locator(`.audio-cell:nth-child(${nthChild})`);
    await audioCell.click();
    await page.keyboard.press(`${ctrlLike}+Digit${digit}`);
  });
}

/** AudioCellを範囲選択する */
export async function selectAudioCellRange(
  page: Page,
  startIndex: number,
  endIndex: number,
) {
  await test.step(`${startIndex}番目から${endIndex}番目のAudioCellを範囲選択`, async () => {
    await page.locator(`.audio-cell:nth-child(${startIndex})`).click();
    await page.keyboard.down("Shift");
    await page.locator(`.audio-cell:nth-child(${endIndex})`).click();
    await page.keyboard.up("Shift");
  });
}

/** トーク音声書き出し完了の通知を確認して閉じる */
export async function waitForExportNotificationAndClose(page: Page) {
  await test.step("トーク音声書き出し完了の通知を確認して閉じる", async () => {
    // NOTE: なぜか前のnotifyの結果残ってしまっているので、.last()を使う
    const notify = page.locator("#q-notify");
    await expect(notify.getByText("音声を書き出しました").last()).toBeVisible();
    await notify.getByRole("button", { name: "閉じる" }).last().click();
    await expect(notify).not.toBeVisible();
  });
}

/** プラットフォームに応じたCtrlキー。MacではMeta、それ以外ではControl。 */
export const ctrlLike = process.platform === "darwin" ? "Meta" : "Control";
