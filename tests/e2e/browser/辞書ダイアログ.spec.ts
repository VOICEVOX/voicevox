import { test, expect, type Page, type Locator } from "@playwright/test";
import { gotoHome, navigateToMain } from "../navigators";

test.beforeEach(gotoHome);

function createUniqueSurfaceCreator(): (label: string) => string {
  let surfaceIndex = 0;
  return (label: string) => {
    surfaceIndex++;
    return `辞書${label}${"あ".repeat(surfaceIndex)}`;
  };
}
const createSurface = createUniqueSurfaceCreator();

async function getYomi(page: Page, inputText: string): Promise<string> {
  const audioCellInput = page.getByRole("textbox", { name: "行目" }).last();
  const accentPhrase = page.locator(".accent-phrase");

  await audioCellInput.click();
  await audioCellInput.fill("");
  await audioCellInput.press("Enter");
  await expect(accentPhrase).not.toBeVisible();

  await audioCellInput.click();
  await audioCellInput.fill(inputText);
  await audioCellInput.press("Enter");
  await expect(accentPhrase).not.toHaveCount(0);

  return (await accentPhrase.allTextContents()).join("");
}

async function openDictDialog(page: Page): Promise<void> {
  await test.step("辞書ダイアログを開く", async () => {
    await page.getByRole("button", { name: "設定" }).click();
    await page.waitForTimeout(100);
    await page.getByText("読み方＆アクセント辞書").click();
    await expect(
      page.locator("header", { hasText: "読み方＆アクセント辞書" }),
    ).toBeVisible();
    await expect(page.getByText("単語一覧")).toBeVisible();
    await expect(page.getByText("読み込み中・・・")).toBeHidden();
    await expect(page.getByText("同期中・・・")).toBeHidden();
  });
}

async function closeDictDialog(page: Page): Promise<void> {
  await test.step("辞書ダイアログを閉じる", async () => {
    await page
      .locator("header", { hasText: "読み方＆アクセント辞書" })
      .getByRole("button")
      .filter({ hasText: "close" })
      .click();
    await expect(
      page.locator("header", { hasText: "読み方＆アクセント辞書" }),
    ).toBeHidden();
  });
}

function getWordField(page: Page, label: "単語" | "読み"): Locator {
  return page
    .locator(".form-row")
    .filter({ has: page.locator(".headline", { hasText: label }) })
    .getByRole("textbox");
}

function getWordItem(page: Page, surface: string): Locator {
  return page.getByRole("listitem").filter({ hasText: surface });
}

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

async function selectNewWord(page: Page): Promise<void> {
  await test.step("新しい単語の追加画面を開く", async () => {
    await page
      .locator(".list-header")
      .getByRole("button")
      .filter({ hasText: "追加" })
      .click();
    await expect(page.getByText("新しい単語の追加")).toBeVisible();
  });
}

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

async function addWord(
  page: Page,
  surface: string,
  yomi: string,
  expectedSurface = surface,
): Promise<void> {
  await selectNewWord(page);
  await fillWord(page, surface, yomi, expectedSurface);

  await test.step("単語を追加する", async () => {
    await page
      .locator("footer")
      .getByRole("button")
      .filter({ hasText: "追加" })
      .click();
    await expect(getWordItem(page, expectedSurface)).toBeVisible();
    await expect(page.getByText("単語の編集")).toBeVisible();
  });
}

async function selectWord(page: Page, surface: string): Promise<void> {
  await test.step(`${surface}を選択する`, async () => {
    await getWordItem(page, surface).click();
    await expect(page.getByText("単語の編集")).toBeVisible();
    await expect(getWordField(page, "単語")).toHaveText(surface);
  });
}

async function openDeleteWordDialog(
  page: Page,
  surface: string,
): Promise<Locator> {
  return await test.step("単語の削除ダイアログを開く", async () => {
    const wordItem = getWordItem(page, surface);
    await wordItem.hover();
    await wordItem.getByText("delete_outline").click();
    const dialog = page.getByRole("dialog", { name: "単語を削除しますか？" });
    await expect(dialog).toBeVisible();
    return dialog;
  });
}

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
    await page
      .locator("footer")
      .getByRole("button")
      .filter({ hasText: "リセット" })
      .click();
    await expect(getWordField(page, "単語")).toHaveText("");
    await expect(getWordField(page, "読み")).toHaveText("");
    await expect(page.locator(".detail .accent-phrase-table")).toBeHidden();
    await expect(
      page.locator("footer").getByRole("button").filter({ hasText: "追加" }),
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
    await page
      .locator(".list-header")
      .getByRole("button")
      .filter({ hasText: "追加" })
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

  await test.step("削除した単語が読みに反映されない", async () => {
    await page.getByRole("button").filter({ hasText: "add" }).click();
    expect(await getYomi(page, targetString)).toBe(yomi);
  });
});
