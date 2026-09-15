import { expect, type Locator, type Page, test } from "@playwright/test";
import { getNewestQuasarDialog, getQuasarMenu } from "./locators";

export async function gotoHome({ page }: { page: Page }) {
  await test.step("最初の画面へ移動する", async () => {
    const BASE_URL = "http://localhost:7357/";
    await page.setViewportSize({ width: 1024, height: 630 });
    await page.goto(BASE_URL);
  });
}

export async function navigateToEditorSelection(
  page: Page,
  {
    shouldConfirmCharacterOrder = true,
  }: { shouldConfirmCharacterOrder?: boolean } = {},
): Promise<Locator> {
  await test.step("利用規約に同意する", async () => {
    await expect(page.getByText("利用規約に関するお知らせ")).toBeVisible({
      timeout: 90 * 1000,
    });
    await page.getByRole("button", { name: "同意して使用開始" }).click();
  });

  if (shouldConfirmCharacterOrder) {
    await test.step("キャラクターの並び順を確定する", async () => {
      const completeButton = page.getByRole("button", { name: "完了" });
      await expect(completeButton).toBeVisible();
      await completeButton.click();
    });
  }

  await test.step("テレメトリーを許可する", async () => {
    const allowButton = page.getByRole("button", { name: "許可" });
    await expect(allowButton).toBeVisible();
    await allowButton.click();
  });

  return await test.step("エディタ選択を表示する", async () => {
    const dialog = page.getByRole("dialog", {
      name: "どちらに興味がありますか？",
    });
    await expect(dialog).toBeVisible();
    return dialog;
  });
}

async function selectInitialEditor(page: Page, editor: "トーク" | "ソング") {
  const dialog = await navigateToEditorSelection(page);

  await test.step(`${editor}を選択する`, async () => {
    await dialog.getByRole("button", { name: editor }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("button", { name: editor, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });
}

export async function navigateToTalk(page: Page) {
  await selectInitialEditor(page, "トーク");

  await test.step("トーク画面を操作可能にする", async () => {
    await expect(page.getByRole("textbox", { name: "1行目" })).toBeVisible({
      timeout: 90 * 1000,
    });
  });
}

export async function toggleSetting(page: Page, settingName: string) {
  await test.step(`設定 ${settingName} をトグルする`, async () => {
    await page.getByRole("button", { name: "設定" }).click();
    await page.waitForTimeout(100);
    await page.getByText("オプション").click();
    await page.waitForTimeout(100);
    await page
      .locator(".row-card", {
        has: page.getByText(settingName),
      })
      .click();
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "設定を閉じる" }).click();
  });
  await page.waitForTimeout(500);
}

export async function navigateToHelpDialog(page: Page): Promise<Locator> {
  await navigateToTalk(page);
  return await test.step("ヘルプダイアログまで移動する", async () => {
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "ヘルプ" }).click();
    return getNewestQuasarDialog(page);
  });
}

export async function navigateToSettingDialog(page: Page): Promise<Locator> {
  await navigateToTalk(page);
  return await test.step("設定ダイアログまで移動する", async () => {
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "設定" }).click();
    await getQuasarMenu(page, "オプション").click();
    return getNewestQuasarDialog(page);
  });
}

export async function navigateToSong(page: Page) {
  await selectInitialEditor(page, "ソング");

  await test.step("スナップを1/8に変更する", async () => {
    await page.getByLabel("スナップ").click();
    await page.getByRole("option", { name: "1/8", exact: true }).click();
  });
}
