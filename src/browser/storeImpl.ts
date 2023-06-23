import { defaultEngine, directoryHandleStoreKey } from "./contract";

import {
  electronStoreSchema,
  ElectronStoreType,
  EngineId,
  engineSettingSchema,
} from "@/type/preload";

const dbName = "voicevox-web";
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
        Object.entries(baseSchema).forEach(([key, value]) => {
          const k = key as keyof typeof baseSchema;
          if (k !== "engineSettings") {
            db.createObjectStore(key).add(value, entryKey);
            return;
          }
          // defaultのEngineSettingを追加
          const defaultVoicevoxEngineId = EngineId(defaultEngine.uuid);
          db.createObjectStore(key).add(
            {
              [defaultVoicevoxEngineId]: engineSettingSchema.parse({}),
            },
            entryKey
          );
        });

        // DirectoryHandleも格納する
        db.createObjectStore(directoryHandleStoreKey);
      }
      // TODO: migrate
    };
  });

export const setSettingEntry = async <Key extends keyof ElectronStoreType>(
  key: Key,
  newValue: ElectronStoreType[Key]
) => {
  const db = await openDB();

  // TODO: Schemaに合っているか保存時にvalidationしたい
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(key, "readwrite");
    const store = transaction.objectStore(key);
    const request = store.put(newValue, entryKey);
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const getSettingEntry = async <Key extends keyof ElectronStoreType>(
  key: Key
): Promise<ElectronStoreType[Key]> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(key, "readonly");
    const store = transaction.objectStore(key);
    const request = store.get(entryKey);
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};
