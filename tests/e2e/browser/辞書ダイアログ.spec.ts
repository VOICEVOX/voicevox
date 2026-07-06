import { test, expect, type Page, type Locator } from "@playwright/test";
import { gotoHome, navigateToMain } from "../navigators";
import { getNewestQuasarDialog } from "../locators";

test.beforeEach(gotoHome);

/**
 * テスト内で追加する単語名を生成する。
 */
function createUniqueSurfaceCreator(): (label: string) => string {
  let surfaceIndex = 0;
  return (label: string) => {
    surfaceIndex++;
    return `辞書${label}${"あ".repeat(surfaceIndex)}`;
  };
}
const createSurface = createUniqueSurfaceCreator();

/**
 * 最後のテキスト欄にテキストを入力し、その読みを取得する。
 * 確実に読みを反映させるために、一度空にしてから入力する。
 */
async function getYomi(page: Page, inputText: string): Promise<string> {
  const audioCellInput = page.getByRole("textbox", { name: "行目" }).last();
  const accentPhrase = page.locator(".accent-phrase");

  // 空にする
  await audioCellInput.click();
  await audioCellInput.fill("");
  await audioCellInput.press("Enter");
  await expect(accentPhrase).not.toBeVisible();

  // 入力する
  await audioCellInput.click();
  await audioCellInput.fill(inputText);
  await audioCellInput.press("Enter");
  await expect(accentPhrase).not.toHaveCount(0);

  return (await accentPhrase.allTextContents()).join("");
}

/**
 * 設定メニューから読み方＆アクセント辞書ダイアログを開く。
 * 辞書の読み込みと同期が終わるまで待つ。
 */
async function openDictDialog(page: Page): Promise<void> {
  await test.step("辞書ダイアログを開く", async () => {
    await page.getByRole("button", { name: "設定" }).click();
    await page.waitForTimeout(100);
    await page.getByText("読み方＆アクセント辞書").click();
    await expect(
      getNewestQuasarDialog(page).getByText("単語一覧"),
    ).toBeVisible();
    await expect(page.getByText("読み込み中・・・")).toBeHidden();
    await expect(page.getByText("同期中・・・")).toBeHidden();
  });
}

/**
 * 読み方＆アクセント辞書ダイアログを閉じる。
 */
async function closeDictDialog(page: Page): Promise<void> {
  await test.step("辞書ダイアログを閉じる", async () => {
    await getNewestQuasarDialog(page)
      .getByRole("button", { name: "辞書を閉じる" })
      .click();
    await expect(
      getNewestQuasarDialog(page).getByText("単語一覧"),
    ).toBeHidden();
  });
}

/**
 * 単語編集画面の入力欄を取得する。
 */
function getWordField(page: Page, label: "単語" | "読み"): Locator {
  return page.getByRole("textbox", { name: label });
}

/**
 * 単語一覧から指定した単語の項目を取得する。
 */
function getWordItem(page: Page, surface: string): Locator {
  return page.getByRole("listitem").filter({ hasText: surface });
}

/**
 * BaseTextField に値を入力する。
 * contenteditable の入力欄なので、テキストを直接差し替えて input イベントを発火させる。
 */
async function fillTextField(
  input: Locator,
  value: string,
  expectedValue = value,
): Promise<void> {
  await input.evaluate((element: HTMLElement, text: string) => {
    element.textContent = text;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  await input.press("Enter");
  await expect(input).toHaveText(expectedValue);
}

/**
 * 新しい単語の追加画面を開く。
 */
async function selectNewWord(page: Page): Promise<void> {
  await test.step("新しい単語の追加画面を開く", async () => {
    await getNewestQuasarDialog(page)
      .getByRole("button", { name: "単語を追加" })
      .click();
    await expect(page.getByText("新しい単語の追加")).toBeVisible();
  });
}

/**
 * 単語編集画面で単語と読みを入力する。
 * 単語は入力後に全角化される場合があるため、表示上の期待値を別に指定できる。
 */
async function fillWord(
  page: Page,
  surface: string,
  yomi: string,
  expectedSurface = surface,
) {
  await test.step("単語と読みを入力する", async () => {
    await fillTextField(getWordField(page, "単語"), surface, expectedSurface);
    await fillTextField(getWordField(page, "読み"), yomi);
    await expect(page.locator(".detail .accent-phrase-table")).toBeVisible();
  });
}

/**
 * 新しい単語を追加して、追加後の編集画面まで移動する。
 */
async function addWord(
  page: Page,
  surface: string,
  yomi: string,
  expectedSurface = surface,
): Promise<void> {
  await selectNewWord(page);
  await fillWord(page, surface, yomi, expectedSurface);

  await test.step("単語を追加する", async () => {
    await getNewestQuasarDialog(page)
      .locator("footer")
      .getByRole("button", { name: "追加" })
      .click();
    await expect(getWordItem(page, expectedSurface)).toBeVisible();
    await expect(page.getByText("単語の編集")).toBeVisible();
  });
}

/**
 * 単語一覧から指定した単語を選択する。
 */
async function selectWord(page: Page, surface: string): Promise<void> {
  await test.step(`${surface}を選択する`, async () => {
    await getWordItem(page, surface).click();
    await expect(page.getByText("単語の編集")).toBeVisible();
    await expect(getWordField(page, "単語")).toHaveText(surface);
  });
}

/**
 * 指定した単語の削除確認ダイアログを開く。
 */
async function openDeleteWordDialog(
  page: Page,
  surface: string,
): Promise<Locator> {
  return await test.step("単語の削除ダイアログを開く", async () => {
    const wordItem = getWordItem(page, surface);
    await wordItem.hover();
    await wordItem.getByRole("button", { name: "削除" }).click();
    const dialog = page.getByRole("dialog", { name: "単語を削除しますか？" });
    await expect(dialog).toBeVisible();
    return dialog;
  });
}

/**
 * 指定したタイトルの警告ダイアログを取得する。
 */
async function expectWarningDialog(
  page: Page,
  title: string,
): Promise<Locator> {
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("辞書ダイアログを表示できる", async ({ page }) => {
  await navigateToMain(page);
  await openDictDialog(page);
});

test("単語を追加できる", async ({ page }) => {
  const surface = createSurface("追加");

  await navigateToMain(page);
  await openDictDialog(page);
  await addWord(page, surface, "テスト");

  await test.step("追加した単語が一覧に表示される", async () => {
    await expect(getWordItem(page, surface)).toBeVisible();
    await expect(getWordItem(page, surface)).toContainText("テスト");
  });
});

test("単語を削除できる", async ({ page }) => {
  const surface = createSurface("削除");

  await navigateToMain(page);
  await openDictDialog(page);
  await addWord(page, surface, "テスト");
  const dialog = await openDeleteWordDialog(page, surface);

  await test.step("削除を確定する", async () => {
    await dialog.getByRole("button").filter({ hasText: "削除する" }).click();
    await expect(getWordItem(page, surface)).toBeHidden();
  });
});

test("単語の削除をキャンセルできる", async ({ page }) => {
  const surface = createSurface("削除キャンセル");

  await navigateToMain(page);
  await openDictDialog(page);
  await addWord(page, surface, "テスト");
  const dialog = await openDeleteWordDialog(page, surface);

  await test.step("削除をキャンセルする", async () => {
    await dialog.getByRole("button").filter({ hasText: "削除しない" }).click();
    await expect(getWordItem(page, surface)).toBeVisible();
  });
});

test("新しい単語を入力したあと他の単語へ切り替えようとすると破棄の警告が出る", async ({
  page,
}) => {
  const existingSurface = createSurface("既存");

  await navigateToMain(page);
  await openDictDialog(page);
  await addWord(page, existingSurface, "テスト");
  await selectNewWord(page);
  await fillWord(page, createSurface("未保存"), "ヨミ");

  await test.step("他の単語を選択しようとする", async () => {
    await getWordItem(page, existingSurface).click();
    const dialog = await expectWarningDialog(
      page,
      "単語の追加を破棄しますか？",
    );
    await expect(
      dialog.getByText("変更を破棄すると、単語の追加はリセットされます。"),
    ).toBeVisible();
  });
});

test("単語を編集したあと他の単語を選択すると保存される", async ({ page }) => {
  const firstSurface = createSurface("編集元");
  const secondSurface = createSurface("編集先");
  const editedSurface = `${firstSurface}変更`;

  await navigateToMain(page);
  await openDictDialog(page);
  await addWord(page, firstSurface, "テスト");
  await addWord(page, secondSurface, "サンプル");
  await selectWord(page, firstSurface);

  await test.step("単語を編集して他の単語を選択する", async () => {
    await fillTextField(getWordField(page, "単語"), editedSurface);
    await getWordItem(page, secondSurface).click();
    await expect(getWordField(page, "単語")).toHaveText(secondSurface);
  });

  await selectWord(page, editedSurface);
});

test("単語を編集したあとダイアログを閉じると保存される", async ({ page }) => {
  const surface = createSurface("閉じる保存");
  const editedSurface = `${surface}変更`;

  await navigateToMain(page);
  await openDictDialog(page);
  await addWord(page, surface, "テスト");
  await selectWord(page, surface);

  await test.step("単語を編集してダイアログを閉じる", async () => {
    await fillTextField(getWordField(page, "単語"), editedSurface);
  });

  await closeDictDialog(page);
  await openDictDialog(page);
  await selectWord(page, editedSurface);
});

test("単語を無効な状態にしたあと他の単語を選択しようとして破棄しないと編集画面に留まる", async ({
  page,
}) => {
  const firstSurface = createSurface("無効維持");
  const secondSurface = createSurface("無効維持先");

  await navigateToMain(page);
  await openDictDialog(page);
  await addWord(page, firstSurface, "テスト");
  await addWord(page, secondSurface, "サンプル");
  await selectWord(page, firstSurface);

  await test.step("読みを無効な状態にする", async () => {
    await fillTextField(getWordField(page, "読み"), "abc");
    await expect(
      page.getByText("ひらがなとカタカナ以外の文字が入力されています。"),
    ).toBeVisible();
  });

  await test.step("破棄しないと元の単語に留まる", async () => {
    await getWordItem(page, secondSurface).click();
    const dialog = await expectWarningDialog(
      page,
      "単語の変更をキャンセルしますか？",
    );
    await dialog.getByRole("button").filter({ hasText: "破棄しない" }).click();
    await expect(getWordField(page, "単語")).toHaveText(firstSurface);
    await expect(getWordField(page, "読み")).toHaveText("abc");
  });
});

test("単語を無効な状態にしたあと他の単語を選択しようとして破棄すると切り替わる", async ({
  page,
}) => {
  const firstSurface = createSurface("無効破棄");
  const secondSurface = createSurface("無効破棄先");

  await navigateToMain(page);
  await openDictDialog(page);
  await addWord(page, firstSurface, "テスト");
  await addWord(page, secondSurface, "サンプル");
  await selectWord(page, firstSurface);

  await test.step("読みを無効な状態にする", async () => {
    await fillTextField(getWordField(page, "読み"), "abc");
    await expect(
      page.getByText("ひらがなとカタカナ以外の文字が入力されています。"),
    ).toBeVisible();
  });

  await test.step("破棄すると他の単語に切り替わる", async () => {
    await getWordItem(page, secondSurface).click();
    const dialog = await expectWarningDialog(
      page,
      "単語の変更をキャンセルしますか？",
    );
    await dialog.getByRole("button").filter({ hasText: "破棄する" }).click();
    await expect(getWordField(page, "単語")).toHaveText(secondSurface);
  });
});

test("単語を無効な状態にしたあと同じ単語を選択して破棄すると編集内容が戻る", async ({
  page,
}) => {
  const surface = createSurface("同じ単語破棄");

  await navigateToMain(page);
  await openDictDialog(page);
  await addWord(page, surface, "テスト");
  await selectWord(page, surface);

  await test.step("読みを無効な状態にする", async () => {
    await fillTextField(getWordField(page, "読み"), "abc");
    await expect(
      page.getByText("ひらがなとカタカナ以外の文字が入力されています。"),
    ).toBeVisible();
  });

  await test.step("同じ単語を選択して破棄すると編集内容が戻る", async () => {
    await getWordItem(page, surface).click();
    const dialog = await expectWarningDialog(
      page,
      "単語の変更をキャンセルしますか？",
    );
    await dialog.getByRole("button").filter({ hasText: "破棄する" }).click();
    await expect(getWordField(page, "単語")).toHaveText(surface);
    await expect(getWordField(page, "読み")).toHaveText("テスト");
    await expect(
      page.getByText("ひらがなとカタカナ以外の文字が入力されています。"),
    ).toBeHidden();
  });
});

test("新しい単語の入力をリセットできる", async ({ page }) => {
  await navigateToMain(page);
  await openDictDialog(page);
  await selectNewWord(page);
  await fillWord(page, createSurface("リセット"), "テスト");

  await test.step("入力をリセットする", async () => {
    await getNewestQuasarDialog(page)
      .locator("footer")
      .getByRole("button", { name: "リセット" })
      .click();
    await expect(getWordField(page, "単語")).toHaveText("");
    await expect(getWordField(page, "読み")).toHaveText("");
    await expect(page.locator(".detail .accent-phrase-table")).toBeHidden();
    await expect(
      getNewestQuasarDialog(page)
        .locator("footer")
        .getByRole("button", { name: "追加" }),
    ).toBeDisabled();
  });
});

test("新しい単語の入力後に追加を選択して破棄すると入力内容が戻る", async ({
  page,
}) => {
  await navigateToMain(page);
  await openDictDialog(page);
  await selectNewWord(page);
  await fillWord(page, createSurface("追加再選択"), "テスト");

  await test.step("追加を選択して破棄すると入力内容が戻る", async () => {
    await getNewestQuasarDialog(page)
      .getByRole("button", { name: "単語を追加" })
      .click();
    const dialog = await expectWarningDialog(
      page,
      "単語の追加を破棄しますか？",
    );
    await dialog.getByRole("button").filter({ hasText: "破棄する" }).click();
    await expect(getWordField(page, "単語")).toHaveText("");
    await expect(getWordField(page, "読み")).toHaveText("");
    await expect(page.locator(".detail .accent-phrase-table")).toBeHidden();
  });
});

test("読みをひらがなで入力するとカタカナで保存される", async ({ page }) => {
  const surface = createSurface("ひらがな");

  await navigateToMain(page);
  await openDictDialog(page);
  await addWord(page, surface, "てすと");

  await test.step("読みがカタカナで表示される", async () => {
    await expect(getWordItem(page, surface)).toContainText("テスト");
  });
});

test("単語を半角で入力すると全角で保存される", async ({ page }) => {
  const surface = "abc123";
  const convertedSurface = "ａｂｃ１２３";

  await navigateToMain(page);
  await openDictDialog(page);
  await addWord(page, surface, "テスト", convertedSurface);

  await test.step("単語が全角で表示される", async () => {
    await expect(getWordItem(page, convertedSurface)).toBeVisible();
  });
});

test("追加した単語がテキストの読みに反映され、削除すると反映されなくなる", async ({
  page,
}) => {
  const targetString = createSurface("反映");

  await navigateToMain(page);

  // 文字列を入力して読み方を記憶する
  const yomi = await test.step("登録前の読みを取得する", async () => {
    return await getYomi(page, targetString);
  });

  await openDictDialog(page);
  await addWord(page, targetString, "テスト");
  await closeDictDialog(page);

  await test.step("追加した単語が読みに反映される", async () => {
    await page.getByRole("button").filter({ hasText: "add" }).click();
    expect(await getYomi(page, targetString)).toBe("テスト");
  });

  await openDictDialog(page);
  const dialog = await openDeleteWordDialog(page, targetString);

  await test.step("単語を削除してダイアログを閉じる", async () => {
    await dialog.getByRole("button").filter({ hasText: "削除する" }).click();
  });

  await closeDictDialog(page);

  // 辞書から削除されていることを確認
  // （＝最初の読み方と同じになっていることを確認）
  await test.step("削除した単語が読みに反映されない", async () => {
    await page.getByRole("button").filter({ hasText: "add" }).click();
    expect(await getYomi(page, targetString)).toBe(yomi);
  });
});
