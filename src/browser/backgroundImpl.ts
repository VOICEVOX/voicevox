import type { IpcIHData } from "@/type/ipc";
import {
  EngineId,
  EngineInfo,
  EngineSettings,
  ThemeConf,
  defaultHotkeySettings,
  defaultToolbarButtonSetting,
  electronStoreSchema,
  engineSettingSchema,
} from "@/type/preload";
import {
  ContactTextFileName,
  HowToUseTextFileName,
  OssCommunityInfosFileName,
  OssLicensesJsonFileName,
  PolicyTextFileName,
  PrivacyPolicyTextFileName,
  QAndATextFileName,
  UpdateInfosJsonFileName,
} from "@/type/staticResources";

type SandboxImpl = {
  [K in keyof IpcIHData]: (
    args: IpcIHData[K]["args"]
  ) => Promise<IpcIHData[K]["return"]>;
};

export const getAppInfosImpl: SandboxImpl["GET_APP_INFOS"] = () => {
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  const appInfo = {
    name: process.env.APP_NAME!,
    version: process.env.APP_VERSION!,
  };
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
  return Promise.resolve(appInfo);
};

/**
 * @deprecated ブラウザ版では使用されていないはずです
 */
export const getTempDirImpl: SandboxImpl["GET_TEMP_DIR"] = () => {
  console.error("Not Implemented, it should not be called from VOICEVOX");
  return Promise.resolve("");
};

// TODO: base pathを設定できるようにするか、ビルド時埋め込みにする
const toStaticPath = (fileName: string) => `/${fileName}`;

export const getHowToUseTextImpl: SandboxImpl["GET_HOW_TO_USE_TEXT"] = () => {
  return fetch(toStaticPath(HowToUseTextFileName)).then((v) => v.text());
};

export const getPolicyTextImpl: SandboxImpl["GET_POLICY_TEXT"] = () => {
  return fetch(toStaticPath(PolicyTextFileName)).then((v) => v.text());
};

export const getOssCommunityInfosImpl: SandboxImpl["GET_OSS_COMMUNITY_INFOS"] =
  () => {
    return fetch(toStaticPath(OssCommunityInfosFileName)).then((v) => v.text());
  };

export const getContactTextImpl: SandboxImpl["GET_CONTACT_TEXT"] = () => {
  return fetch(toStaticPath(ContactTextFileName)).then((v) => v.text());
};

export const getQAndATextImpl: SandboxImpl["GET_Q_AND_A_TEXT"] = () => {
  return fetch(toStaticPath(QAndATextFileName)).then((v) => v.text());
};

export const getPrivacyPolicyTextImpl: SandboxImpl["GET_PRIVACY_POLICY_TEXT"] =
  () => {
    return fetch(toStaticPath(PrivacyPolicyTextFileName)).then((v) => v.text());
  };

export const getOssLicensesImpl: SandboxImpl["GET_OSS_LICENSES"] = () => {
  return fetch(toStaticPath(OssLicensesJsonFileName)).then((v) => v.json());
};

export const getUpdateInfosImpl: SandboxImpl["GET_UPDATE_INFOS"] = () => {
  return fetch(toStaticPath(UpdateInfosJsonFileName)).then((v) => v.json());
};

/**
 * @deprecated ブラウザ版ではサポートされていません
 */
export const getAltPortInfosImpl: SandboxImpl["GET_ALT_PORT_INFOS"] = () => {
  return Promise.resolve({});
};

/**
 * @deprecated ブラウザ版では不要です
 */
export const openTextEditContextMenuImpl: SandboxImpl["OPEN_TEXT_EDIT_CONTEXT_MENU"] =
  () => {
    return Promise.resolve();
  };

export const logErrorImpl: SandboxImpl["LOG_ERROR"] = ([...params]) => {
  console.error(...params);
  return Promise.resolve();
};

export const logWarnImpl: SandboxImpl["LOG_ERROR"] = ([...params]) => {
  console.warn(...params);
  return Promise.resolve();
};

export const logInfoImpl: SandboxImpl["LOG_ERROR"] = ([...params]) => {
  console.info(...params);
  return Promise.resolve();
};

const defaultEngine: EngineInfo = {
  uuid: EngineId("074fc39e-678b-4c13-8916-ffca8d505d1d"),
  host: "http://127.0.0.1:50021",
  name: "VOICEVOX Engine",
  path: undefined,
  executionEnabled: false,
  executionFilePath: "",
  executionArgs: [],
  type: "default",
};

export const engineInfosImpl: SandboxImpl["ENGINE_INFOS"] = async () => {
  return [defaultEngine];
};

export const hotkeySettingsImpl: SandboxImpl["HOTKEY_SETTINGS"] = async ([
  { newData },
]) => {
  type HotkeySettingType = ReturnType<
    typeof electronStoreSchema["parse"]
  >["hotkeySettings"];
  if (newData !== undefined) {
    const hotkeySettings = (await getSettingImpl([
      "hotkeySettings",
    ])) as HotkeySettingType;
    const hotkeySetting = hotkeySettings.find(
      (hotkey) => hotkey.action == newData.action
    );
    if (hotkeySetting !== undefined) {
      hotkeySetting.combination = newData.combination;
    }
    await setSettingImpl(["hotkeySettings", hotkeySettings]);
  }
  return getSettingImpl(["hotkeySettings"]) as Promise<HotkeySettingType>;
};

export const getDefaultHotkeySettingsImpl: SandboxImpl["GET_DEFAULT_HOTKEY_SETTINGS"] =
  () => {
    return Promise.resolve(defaultHotkeySettings);
  };

export const getDefaultToolbarSettingImpl: SandboxImpl["GET_DEFAULT_TOOLBAR_SETTING"] =
  () => {
    return Promise.resolve(defaultToolbarButtonSetting);
  };

export const themeImpl: SandboxImpl["THEME"] = async ([{ newData }]) => {
  if (newData !== undefined) {
    await setSettingImpl(["currentTheme", newData]);
    return;
  }
  return Promise.all(
    // FIXME: themeファイルのいい感じのパスの設定
    ["/themes/default.json", "/themes/dark.json"].map((url) =>
      fetch(url).then((res) => res.json())
    )
  )
    .then((v) => ({
      currentTheme: "Default",
      availableThemes: v,
    }))
    .then((v) =>
      getSettingImpl(["currentTheme"]).then(
        (currentTheme) =>
          ({
            ...v,
            currentTheme,
          } as { currentTheme: string; availableThemes: ThemeConf[] })
      )
    );
};

const dbName = "voicevox-web";
// FIXME: DBのバージョンを何かしらの形で行いたい
const dbVersion = 1;
// NOTE: settingを複数持つことはないと仮定して、keyを固定してしまう
const entryKey = "value";

const openDB = () =>
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
      }
      // TODO: migrate
    };
  });

let db: IDBDatabase | null = null;

export const getSettingImpl: SandboxImpl["GET_SETTING"] = async ([key]) => {
  if (db === null) {
    db = await openDB();
  }

  if (db === null) {
    throw new Error("db is null");
  }

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const transaction = db!.transaction(key, "readonly");
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

export const setSettingImpl: SandboxImpl["SET_SETTING"] = async ([
  key,
  value,
]) => {
  if (db === null) {
    db = await openDB();
  }

  if (db === null) {
    throw new Error("db is null");
  }

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const transaction = db!.transaction(key, "readwrite");
    const store = transaction.objectStore(key);
    const request = store.put(value, entryKey);
    request.onsuccess = () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const readRequest = db!
        .transaction(key, "readonly")
        .objectStore(key)
        .get(entryKey);
      readRequest.onsuccess = () => {
        resolve(readRequest.result);
      };
      readRequest.onerror = () => {
        reject(readRequest.error);
      };
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};

export const setEngineSettingImpl: SandboxImpl["SET_ENGINE_SETTING"] = async ([
  engineId,
  newData,
]) => {
  const engineSettings = (await getSettingImpl([
    "engineSettings",
  ])) as EngineSettings;
  engineSettings[engineId] = newData;
  await setSettingImpl(["engineSettings", engineSettings]);
  return;
};
