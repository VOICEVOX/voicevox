import { defaultEngine, directoryHandleStoreKey } from "./contract";
import {
  EngineId,
  electronStoreSchema,
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
