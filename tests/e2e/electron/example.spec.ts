import fs from "node:fs/promises";
import { test } from "./fixtures";
import dotenv from "dotenv";
import { getUserTestDir } from "./helper";

test.beforeEach(async () => {
  // キャッシュなどでテスト結果が変化しないように、appDataをテスト起動時に毎回消去する。
  // cf: https://www.electronjs.org/ja/docs/latest/api/app#appgetpathname
  const userDir = getUserTestDir();
  await fs.rm(userDir, {
    recursive: true,
    force: true,
  });
});

test.describe(".env環境", () => {
  test.beforeEach(() => {
    dotenv.config({ path: ".env", override: true, quiet: true });
  });

  test("起動したら「利用規約に関するお知らせ」が表示される", async ({ launchElectronApp }) => {
    const app = await launchElectronApp();

    const sut = await app.firstWindow({
      timeout: process.env.CI ? 90000 : 60000,
    });
    await sut.waitForSelector("text=利用規約に関するお知らせ", {
      timeout: 60000,
    });
  });
});
