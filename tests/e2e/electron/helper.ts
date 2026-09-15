import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import packageJson from "../../../package.json" with { type: "json" };

/** テスト用のユーザーディレクトリパスを取得する */
export function getUserTestDir(): string {
  const appDataMap: Partial<Record<NodeJS.Platform, string>> = {
    win32: process.env.APPDATA,
    darwin: os.homedir() + "/Library/Application Support",
    linux: process.env.XDG_CONFIG_HOME || os.homedir() + "/.config",
  } as const;

  const appData = appDataMap[process.platform];
  if (!appData) {
    throw new Error("Unsupported platform");
  }
  return path.join(appData, `${process.env.VITE_APP_NAME}-test`);
}

/** 初期設定を完了済みにしたテスト用設定を作成する。 */
export async function prepareCompletedInitialSettings() {
  const userDir = getUserTestDir();
  await fs.mkdir(userDir, { recursive: true });
  await fs.writeFile(
    path.join(userDir, "config.json"),
    JSON.stringify(
      {
        // ElectronConfigManagerが保存する設定ファイルのメタデータ。
        // アプリ起動時にBaseConfigManagerが設定スキーマのデフォルト値を補完する。
        __internal__: { migrations: { version: packageJson.version } },
        acceptTerms: "Accepted",
        acceptRetrieveTelemetry: "Refused",
        openedEditor: "talk",
      },
      undefined,
      2,
    ),
  );
}
