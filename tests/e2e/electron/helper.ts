import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

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

/** 古いバージョンのvvpp-enginesディレクトリを作る */
export async function setupOldVersionEngine() {
  const userDir = getUserTestDir();
  const vvppEngineDir = path.join(userDir, "vvpp-engines");

  await fs.mkdir(vvppEngineDir, { recursive: true });
  const sourceOldEngineDir = path.join(import.meta.dirname, "oldEngine");
  const manifestPath = path.join(sourceOldEngineDir, "engine_manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8")) as {
    uuid: string;
    name: string;
  };

  const oldEngineDir = path.join(
    vvppEngineDir,
    `${manifest.name}+${manifest.uuid}`,
  );
  await fs.cp(sourceOldEngineDir, oldEngineDir, { recursive: true });
}
