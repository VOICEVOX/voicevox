import { directoryHandleStoreKey } from "./contract";

import { BaseConfigManager, Metadata } from "@/shared/ConfigManager";
import { ConfigType } from "@/type/preload";

const dbName = `${import.meta.env.VITE_APP_NAME}-web`;
const settingStoreKey = "config";
const dbVersion = 1;
// NOTE: settingを複数持つことはないと仮定して、keyを固定してしまう
const entryKey = "value";

let configManager: BrowserConfigManager | undefined;

export async function getConfigManager(): Promise<BrowserConfigManager> {
  if (!configManager) {
    configManager = new BrowserConfigManager();
    await configManager.initialize();
  }
  return configManager;
}

export const openDB = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      // TODO: handling
      reject(request.error);
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
          `マイグレーション処理が必要です。${ev.oldVersion} => ${ev.newVersion}`
        );
        /* eslint-enable no-console */
      }
    };
  });

class BrowserConfigManager extends BaseConfigManager {
  getAppVersion() {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return process.env.APP_VERSION!;
  }
  async exists() {
    const db = await openDB();

    return await new Promise<boolean>((resolve) => {
      try {
        const transaction = db.transaction(settingStoreKey, "readonly");
        const store = transaction.objectStore(settingStoreKey);
        const request = store.get(entryKey);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result != undefined);
        };
      } catch (e) {
        resolve(false);
      }
    });
  }
  async load(): Promise<Record<string, unknown> & Metadata> {
    const db = await openDB();

    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(settingStoreKey, "readonly");
      const store = transaction.objectStore(settingStoreKey);
      const request = store.get(entryKey);
      request.onsuccess = () => {
        const result = request.result;
        if (result == undefined) {
          reject(new Error("設定ファイルが見つかりません"));
          return;
        }
        resolve(JSON.parse(result));
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async save(data: ConfigType & Metadata) {
    const db = await openDB();

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(settingStoreKey, "readwrite");
      const store = transaction.objectStore(settingStoreKey);
      const request = store.put(JSON.stringify(data), entryKey);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}
