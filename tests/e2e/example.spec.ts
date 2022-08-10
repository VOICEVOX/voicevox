import { test } from "@playwright/test";
import { testWithPlaywright } from "vue-cli-plugin-electron-builder";
import dotenv from "dotenv";

test("起動したら「利用規約に関するお知らせ」が表示される", async () => {
  dotenv.config(); // FIXME: エンジンの設定直読み
  const { app, stop } = await testWithPlaywright();
  const sut = await app.firstWindow();

  // エンジンが起動し「利用規約に関するお知らせ」が表示されるのを待つ
  await sut.waitForSelector("text=利用規約に関するお知らせ");

  await stop();
});
