import { test, expect } from "@playwright/test";

// メモ：
// StoryとIDの対応をリストアップするスクリプト。Storybookの画面を開き、Ctrl+Shift+下で全てのアイテムを開いた状態で、
// ブラウザのコンソールに以下のスクリプトを貼り付けると、コンソールにIDのリストが表示される。
/*
console.log(
  JSON.stringify(
    [...document.querySelectorAll('.sidebar-item[data-nodetype="story"')].map(
      (e) => e.getAttribute("data-item-id"),
    ),
    null,
    2,
  ),
);
*/

// スクリーンショットを撮る対象のID。IDは上のスクリプトで取得したものを使う。
const targets = [
  "components-base-basebutton--default",
  "components-base-basebutton--primary",
  "components-base-basebutton--danger",
  "components-base-basedocumentview--default",
  "components-base-baselistitem--default",
  "components-base-baselistitem--selected",
  "components-base-basenavigationview--default",
  "components-base-baserowcard--default",
  "components-base-baserowcard--clickable",
  "components-base-basescrollarea--default",
  "components-base-baseswitch--unchecked",
  "components-base-baseswitch--checked",
  "components-base-basetextfield--default",
  "components-base-basetextfield--placeholder",
  "components-base-basetextfield--disabled",
  "components-base-basetextfield--read-only",
  "components-base-basetextfield--has-error",
  "components-base-basetogglegroup--single",
  "components-base-basetogglegroup--multiple",
  "components-dialog-settingdialog-filenametemplatedialog--opened",
  "components-dialog-settingdialog-filenametemplatedialog--closed",
  "components-dialog-updatenotificationdialog--opened",
  "components-dialog-updatenotificationdialog--closed",
];

test("スクリーンショット", async ({ page }) => {
  await page.goto("http://localhost:7357");
  const explorer = page.locator("#storybook-explorer-tree");

  // ロードが終わるまで待つ
  await explorer
    .locator('.sidebar-item > [aria-expanded="false"]')
    .first()
    .waitFor({ state: "visible" });

  for (const target of targets) {
    // 全部のアイテムを開く
    // なぜか閉じる時があるので、毎回Ctrl+Shift+下で開く
    await page.keyboard.press("Control+Shift+ArrowDown");
    await page.waitForTimeout(100);
    const item = explorer
      .locator(`.sidebar-item[data-item-id="${target}"] > a`)
      .first();

    const frame = page.frameLocator("#storybook-preview-iframe");

    try {
      await item.click();
    } catch (e) {
      expect.soft(false, `${target} が見つかりません`);
      continue;
    }

    // Addonsを隠す
    if (!(await page.getByLabel("Show addons").isVisible())) {
      await page.keyboard.press("Alt+A");
      await page.waitForTimeout(100);
    }

    // スクリーンショットを撮る
    const body = frame.locator(
      "body.within-iframe:not(.sb-show-preparing-story)",
    );
    await body.waitFor({ state: "visible" });
    await expect.soft(body).toHaveScreenshot(`${target}.png`);
  }
});
