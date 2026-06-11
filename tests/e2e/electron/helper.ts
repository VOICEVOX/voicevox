import os from "node:os";
import path from "node:path";

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
  return path.resolve(appData, `${process.env.VITE_APP_NAME}-test`);
}
