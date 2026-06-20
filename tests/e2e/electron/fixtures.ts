import { test as base, _electron as electron } from "@playwright/test";
import type { ElectronApplication } from "@playwright/test";

type ElectronFixtures = {
  launchElectronApp: () => Promise<ElectronApplication>;
};

/** Electron アプリの起動と終了を管理するフィクスチャ。 */
export const test = base.extend<ElectronFixtures>({
  launchElectronApp: async (_fixtures, use, testInfo) => {
    let app: ElectronApplication | undefined;

    await use(async () => {
      app = await electron.launch({
        args: ["--no-sandbox", "."], // NOTE: --no-sandbox はUbuntu 24.04で動かすのに必要
        timeout: process.env.CI ? 0 : 60000,
      });
      app.on("console", (msg) => {
        console.log(msg.text());
      });
      return app;
    });

    if (app != null) {
      if (testInfo.status !== testInfo.expectedStatus) {
        // テスト失敗時は通常の終了シーケンスを経由せず強制終了させる。
        await app
          .evaluate(({ app }) => {
            app.exit(0);
          })
          .catch((error: unknown) => {
            // app.exit() でプロセスが即座に終了するため CDP エラーが発生する
            console.log("強制終了後の CDP エラー:", error);
          });
      } else {
        await app.close();
      }
    }
  },
});

export { expect } from "@playwright/test";
