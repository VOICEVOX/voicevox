import { test, expect, type Locator } from "@playwright/test";
import { gotoHome, navigateToEditorSelection } from "../navigators";

test.beforeEach(gotoHome);

async function expectEditorOptions(dialog: Locator) {
  await test.step("エディタの選択肢を表示する", async () => {
    await expect(
      dialog.getByText("興味のあるエディターを選んでください。"),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "トーク" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "ソング" })).toBeVisible();
  });
}

test("起動時に利用規約を表示する", async ({ page }) => {
  await test.step("利用規約ダイアログを表示する", async () => {
    await expect(page.getByText("利用規約に関するお知らせ")).toBeVisible({
      timeout: 90 * 1000,
    });
  });

  await test.step("利用規約の内容を表示する", async () => {
    await expect(page.getByText("ダミー利用規約")).toBeVisible();
  });

  await test.step("エディタ切替を表示しない", async () => {
    await expect(
      page.getByRole("button", { name: "トーク", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "ソング", exact: true }),
    ).toHaveCount(0);
  });
});

for (const label of ["トーク", "ソング"] as const) {
  test(`初回設定で${label}を選択できる`, async ({ page }) => {
    const dialog = await navigateToEditorSelection(page);
    await expectEditorOptions(dialog);

    await test.step(`${label}を選択する`, async () => {
      await dialog.getByRole("button", { name: label }).click();
    });

    await test.step(`${label}画面へ遷移する`, async () => {
      await expect(dialog).toBeHidden();
      await expect(
        page.getByRole("button", { name: label, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    });

    await test.step("再起動後も選択結果を復元する", async () => {
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "どちらに興味がありますか？" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: label, exact: true }),
      ).toHaveAttribute("aria-pressed", "true", { timeout: 90 * 1000 });
    });
  });
}
