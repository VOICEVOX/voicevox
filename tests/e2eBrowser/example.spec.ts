import { _electron as electron, test } from "@playwright/test";

test("起動したら「利用規約に関するお知らせ」が表示される", async () => {
  let sut = app.windows()[0];
  if (!sut) sut = await app.waitForEvent("window", { timeout: 0 });

  // エンジンが起動し「利用規約に関するお知らせ」が表示されるのを待つ
  await sut.waitForSelector("text=利用規約に関するお知らせ", { timeout: 0 });
  await app.close();
});
