import { defaultEngine, directoryHandleStoreKey } from "./contract";

import {
  electronStoreSchema,
  ElectronStoreType,
  EngineId,
  engineSettingSchema,
} from "@/type/preload";

const dbName = `${import.meta.env.VITE_APP_NAME}-web`;
const settingStoreKey = "electronStore";
// FIXME: DBのschemaを変更したら、dbVersionを上げる
// TODO: 気づけるようにしたい
const dbVersion = 1;
// NOTE: settingを複数持つことはないと仮定して、keyを固定してしまう
export const entryKey = "value";

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
        const baseSchema = electronStoreSchema.parse({});

        const defaultVoicevoxEngineId = EngineId(defaultEngine.uuid);
        baseSchema.engineSettings = {
          [defaultVoicevoxEngineId]: engineSettingSchema.parse({}),
        };
        db.createObjectStore(settingStoreKey).add(baseSchema, entryKey);

        // NOTE: fixedExportDirectoryを使用してファイルの書き出しをする際、
        // audio.tsの現在の実装では、ディレクトリを選択するモーダルを表示しないようになっている
        // ディレクトリへの書き出し権限の要求は、モーダルの表示かディレクトリを指定したファイルの書き出しの時のみで、
        // directoryHandleがないと権限の要求が出来ないため、directoryHandleを永続化しておく
        db.createObjectStore(directoryHandleStoreKey);
      } else if (ev.newVersion !== null && ev.newVersion > ev.oldVersion) {
        // TODO: migrate
        /* eslint-disable no-console */ // logger みたいなパッケージに切り出して、それに依存する形でもいいかも
        console.error(
          `マイグレーション処理が必要です。${ev.oldVersion} => ${ev.newVersion}`
        );
        /* eslint-enable no-console */
      }
    };
  });

export const setSettingEntry = async <Key extends keyof ElectronStoreType>(
  key: Key,
  newValue: ElectronStoreType[Key]
) => {
  const db = await openDB();

  // TODO: Schemaに合っているか保存時にvalidationしたい
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(settingStoreKey, "readwrite");
    const store = transaction.objectStore(settingStoreKey);
    const getRequest = store.get(entryKey);
    getRequest.onsuccess = () => {
      const baseSchema = electronStoreSchema.parse(getRequest.result);
      baseSchema[key] = newValue;
      const validatedSchema = electronStoreSchema.parse(baseSchema);
      const putRequest = store.put(validatedSchema, entryKey);
      putRequest.onsuccess = () => {
        resolve(putRequest.result);
      };
      putRequest.onerror = () => {
        reject(putRequest.error);
      };
    };
    getRequest.onerror = () => {
      reject(getRequest.error);
    };
  });
};

export const getSettingEntry = async <Key extends keyof ElectronStoreType>(
  key: Key
): Promise<ElectronStoreType[Key]> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(settingStoreKey, "readonly");
    const store = transaction.objectStore(settingStoreKey);
    const request = store.get(entryKey);
    request.onsuccess = () => {
      resolve(request.result[key]);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};
