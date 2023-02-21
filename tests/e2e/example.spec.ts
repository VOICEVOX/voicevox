import { _electron as electron, test } from "@playwright/test";
import dotenv from "dotenv";
import { createServer } from "vite";
import { promises as fs } from "fs";

test("起動したら「利用規約に関するお知らせ」が表示される", async () => {
  dotenv.config(); // FIXME: エンジンの設定直読み
  const server = await createServer({
    mode: "test",
  });
  await server.listen();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await fs.access("./dist/background.js");
      break;
    } catch (e) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const app = await electron.launch({ args: ["."] });
  const sut = await app.firstWindow();

  // エンジンが起動し「利用規約に関するお知らせ」が表示されるのを待つ
  await sut.waitForSelector("text=利用規約に関するお知らせ");

  await app.close();
  await server.close();
});
