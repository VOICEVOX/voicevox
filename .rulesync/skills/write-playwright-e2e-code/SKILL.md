---
name: write-playwright-e2e-code
description: Playwright E2E テストコードを生成。test.step で日本語ステップ名を使用し、コメント禁止。E2E テスト作成・Playwright コード生成時に使用。
---

# Playwright E2E テスト

## test.step 区切り

- 論理的な区切りは `test.step("日本語", async () => { ... })` で表現
- 適切な粒度: ユーザー操作単位・UI 状態確認単位で区切る。入れ子も可
- expect は step 内に含める
- 既に step に分かれている関数は step の外で呼び出す

Good:

```typescript
await navigateToMain(page);

await test.step("ダウンロードモーダルを表示する", async () => {
  await page.getByRole("button", { name: "ダウンロード" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

await test.step("モーダルを閉じると消える", async () => {
  await page.getByRole("button", { name: "閉じる" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});
```

## step 名

- 「何をするか」「どうあるべきか」が分かる表現にする
- 詳細な説明文にはせず、フローの節目を表す短い動詞句にする
- 「～を確認する」など冗長な表現は避ける
- 体言止めは使わない

Good:

```typescript
await test.step("ダウンロードモーダルを表示する", async () => {});
```

Bad 1 (step 名が体言止め):

```typescript
await test.step("ダウンロードモーダルを表示", async () => {});
```

Bad 2 (step 名が冗長):

```typescript
await test.step("ダウンロードボタンをクリックしてモーダルが表示されることを確認する", async () => {});
```

Bad 3 (step 名に「～を確認する」を含む):

```typescript
await test.step("モーダルを閉じると消えることを確認する", async () => {});
```

## コメント

- **What を説明するコメントは削除**: step 名で表現する
- **Why（目的・意図・理由）を説明するコメントは残す**: なぜその待機時間が必要か、なぜその順序で実行するか等

Good (意図を説明):

```typescript
await page.waitForTimeout(5000); // エンジン読み込みを待機
```

## locator・変数の共有

locator の宣言場所は使用範囲で決める:

- **複数 step で使う**: test 関数直下で宣言
- **1 つの step でのみ使う**: その step 内で宣言（外に出さない）

Good:

```typescript
test("テスト名", async ({ page }) => {
  const input = page.getByLabel("入力欄");

  await test.step("入力する", async () => {
    await input.fill("テスト");
  });

  await test.step("入力値が反映される", async () => {
    await expect(input).toHaveValue("テスト");
  });
});
```

Bad 1 (不要な外部宣言):

```typescript
test("テスト名", async ({ page }) => {
  const accentPhrase = page.locator(".accent-phrase");

  await test.step("検証する", async () => {
    await expect(accentPhrase).toBeVisible();
  });
});
```

Bad 2 (重複宣言):

```typescript
test("テスト名", async ({ page }) => {
  await test.step("入力する", async () => {
    const input = page.getByLabel("入力欄");
    await input.fill("テスト");
  });

  await test.step("検証する", async () => {
    const input = page.getByLabel("入力欄");
    await expect(input).toHaveValue("テスト");
  });
});
```

## step 間の値の受け渡し

- **再代入しない**: step から return して const で受け取る
- **再代入する**: let で宣言して step 内で代入

Good 1:

```typescript
const before = await test.step("初期値を取得する", async () => {
  return await getValue(page);
});

await test.step("値が変化している", async () => {
  expect(await getValue(page)).not.toEqual(before);
});
```

Bad 1 (再代入しないのに let で宣言):

```typescript
let before: number;

await test.step("初期値を取得する", async () => {
  before = await getValue(page);
});

await test.step("値が変化している", async () => {
  expect(await getValue(page)).not.toEqual(before);
});
```

Good 2 (再代入する場合は let でも OK):

```typescript
let count: number;

await test.step("1回目の操作をする", async () => {
  await page.getByRole("button").click();
  count = await getCount(page);
  expect(count).toBe(1);
});

await test.step("2回目の操作をする", async () => {
  await page.getByRole("button").click();
  count = await getCount(page);
  expect(count).toBe(2);
});
```

## ロジックの共通化

| スコープ              | 方法                                  |
| --------------------- | ------------------------------------- |
| test 内のみ           | test 関数内で変数やローカル関数を定義 |
| ファイル内の複数 test | ファイルスコープでローカル関数を定義  |
| 複数ファイル          | 共通ファイルにエクスポート関数を追加  |

## 既存コードとの整合

既存ファイル・関数名の指定がある場合はそれを優先。ない場合は既存 E2E の命名・スタイルに合わせる。
