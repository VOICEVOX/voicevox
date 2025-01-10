import AsyncLock from "async-lock";
import { defaultEngine, directoryHandleStoreKey } from "./contract";

import { BaseConfigManager, Metadata } from "@/backend/common/ConfigManager";
import { ConfigType, EngineId, engineSettingSchema } from "@/type/preload";
import { ensureNotNullish } from "@/helpers/errorHelper";
import { UnreachableError } from "@/type/utility";
import { isMac } from "@/helpers/platform";

const dbName = `${import.meta.env.VITE_APP_NAME}-web`;
const settingStoreKey = "config";
const dbVersion = 1; // 固定値。configのmigrationには使用していない。
// NOTE: settingを複数持つことはないと仮定して、keyを固定してしまう
const entryKey = "value";

let configManager: BrowserConfigManager | undefined;

const configManagerLock = new AsyncLock();
const defaultEngineId = EngineId(defaultEngine.uuid);

export async function getConfigManager() {
  await configManagerLock.acquire("configManager", async () => {
    if (!configManager) {
      configManager = new BrowserConfigManager({ isMac });
      await configManager.initialize();
    }
  });

  if (!configManager) {
    throw new Error("configManager is undefined");
  }

  return configManager;
}

const waitRequest = (request: IDBRequest) =>
  new Promise<void>((resolve, reject) => {
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(ensureNotNullish(request.error));
    };
  });

export const openDB = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(ensureNotNullish(request.error));
    };
    request.onupgradeneeded = (ev) => {
      if (ev.oldVersion === 0) {
        // Initialize
        const db = request.result;

        db.createObjectStore(settingStoreKey);

        // NOTE: fixedExportDirectoryを使用してファイルの書き出しをする際、
        // audio.tsの現在の実装では、ディレクトリを選択するモーダルを表示しないようになっている
        // ディレクトリへの書き出し権限の要求は、モーダルの表示かディレクトリを指定したファイルの書き出しの時のみで、
        // directoryHandleがないと権限の要求が出来ないため、directoryHandleを永続化しておく
        db.createObjectStore(directoryHandleStoreKey);
      } else if (ev.newVersion != null && ev.newVersion > ev.oldVersion) {
        // TODO: migrate
        /* eslint-disable no-console */ // logger みたいなパッケージに切り出して、それに依存する形でもいいかも
        console.error(
          `マイグレーション処理が必要です。${ev.oldVersion} => ${ev.newVersion}`,
        );
        /* eslint-enable no-console */
      }
    };
  });

class BrowserConfigManager extends BaseConfigManager {
  protected getAppVersion() {
    return import.meta.env.VITE_APP_VERSION;
  }
  protected async exists() {
    const db = await openDB();

    try {
      const transaction = db.transaction(settingStoreKey, "readonly");
      const store = transaction.objectStore(settingStoreKey);
      const request = store.get(entryKey);
      await waitRequest(request);
      const result: unknown = request.result;
      return result != undefined;
    } catch (e) {
      return false;
    }
  }
  protected async load(): Promise<Record<string, unknown> & Metadata> {
    const db = await openDB();

    const transaction = db.transaction(settingStoreKey, "readonly");
    const store = transaction.objectStore(settingStoreKey);
    const request = store.get(entryKey);
    await waitRequest(request);
    const result: unknown = request.result;
    if (result == undefined) {
      throw new Error("設定ファイルが見つかりません");
    }
    if (typeof result !== "string") {
      throw new UnreachableError("result is not string");
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return JSON.parse(result);
  }

  protected async save(data: ConfigType & Metadata) {
    const db = await openDB();

    const transaction = db.transaction(settingStoreKey, "readwrite");
    const store = transaction.objectStore(settingStoreKey);
    const request = store.put(JSON.stringify(data), entryKey);
    await waitRequest(request);
  }

  protected getDefaultConfig() {
    const baseConfig = super.getDefaultConfig();
    baseConfig.engineSettings[defaultEngineId] ??= engineSettingSchema.parse(
      {},
    );
    return baseConfig;
  }
}
