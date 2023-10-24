import semver from "semver";
import {
  AcceptTermsStatus,
  ConfigType,
  EngineId,
  configSchema,
  DefaultStyleId,
  defaultHotkeySettings,
  HotkeySetting,
} from "@/type/preload";

const migrations: [string, (store: Record<string, unknown>) => unknown][] = [
  [
    ">=0.13",
    (store) => {
      // acceptTems -> acceptTerms
      const prevIdentifier = "acceptTems";
      const prevValue = store[prevIdentifier] as AcceptTermsStatus | undefined;
      if (prevValue) {
        delete store[prevIdentifier];
        store.acceptTerms = prevValue;
      }

      return store;
    },
  ],
  [
    ">=0.14",
    (store) => {
      // FIXME: できるならEngineManagerからEngineIDを取得したい
      let engineId: EngineId;
      if (import.meta.env.VITE_DEFAULT_ENGINE_INFOS == undefined) {
        // 何故かテスト時にundefinedになるのでハードコードする。
        // FIXME: import.meta.env.VITE_DEFAULT_ENGINE_INFOSがundefinedにならないようにする
        if (import.meta.env.MODE === "test") {
          engineId = EngineId("074fc39e-678b-4c13-8916-ffca8d505d1d");
        } else {
          throw new Error("VITE_DEFAULT_ENGINE_INFOS == undefined");
        }
      } else {
        engineId = EngineId(
          JSON.parse(import.meta.env.VITE_DEFAULT_ENGINE_INFOS)[0].uuid
        );
      }
      if (engineId == undefined)
        throw new Error("VITE_DEFAULT_ENGINE_INFOS[0].uuid == undefined");
      const prevDefaultStyleIds = store.defaultStyleIds as DefaultStyleId[];
      store.defaultStyleIds = prevDefaultStyleIds.map((defaultStyle) => ({
        engineId,
        speakerUuid: defaultStyle.speakerUuid,
        defaultStyleId: defaultStyle.defaultStyleId,
      }));

      const outputSamplingRate: number = (
        store.savingSetting as { outputSamplingRate: number }
      ).outputSamplingRate;
      const engineSettings: ConfigType["engineSettings"] = {};
      engineSettings[engineId] = {
        useGpu: store.useGpu as boolean,
        outputSamplingRate:
          outputSamplingRate === 24000 ? "engineDefault" : outputSamplingRate,
      };
      store.engineSettings = engineSettings;

      const savingSetting = store.savingSetting as ConfigType["savingSetting"];
      // @ts-expect-error 削除されたパラメータ。
      delete savingSetting.outputSamplingRate;
      store.savingSetting = savingSetting;

      delete store.useGpu;

      return store;
    },
  ],
];

export type Metadata = {
  __internal__: {
    migrations: {
      version: string;
    };
  };
};

/**
 * 設定の基底クラス
 *
 * # ロジックメモ
 * 保存呼び出しのカウンターを用意する。
 * set（save）が呼ばれる度、カウンターをインクリメントし、保存のPromiseをspawnする。
 *
 * 必ず保存されることを保証する時（アプリ終了時など）は、await finalize()を呼ぶ。
 */
export abstract class BaseConfig {
  protected data: ConfigType | undefined;

  private saveCounter = 0;

  abstract exists(): Promise<boolean>;
  abstract load(): Promise<Record<string, unknown> & Metadata>;
  abstract save(data: ConfigType & Metadata): Promise<void>;

  abstract getAppVersion(): string;

  public async initialize(): Promise<this> {
    if (await this.exists()) {
      const data = await this.load();
      const version = data.__internal__.migrations.version;
      for (const [versionRange, migration] of migrations) {
        if (!semver.satisfies(version, versionRange)) {
          migration(data);
        }
      }
      this.data = this.migrateHotkeySettings(configSchema.parse(data));
    } else {
      const defaultConfig = configSchema.parse({});
      this.data = defaultConfig;
    }
    this._save();

    return this;
  }

  public get<K extends keyof ConfigType>(key: K): ConfigType[K] {
    if (!this.data) throw new Error("Config is not initialized");
    return this.data[key];
  }

  public set<K extends keyof ConfigType>(key: K, value: ConfigType[K]) {
    if (!this.data) throw new Error("Config is not initialized");
    this.data[key] = value;
    this._save();
  }

  private _save() {
    this.saveCounter++;
    (async () => {
      try {
        this.save({
          ...configSchema.parse({
            ...this.data,
          }),
          __internal__: {
            migrations: {
              version: this.getAppVersion(),
            },
          },
        });
      } finally {
        this.saveCounter--;
      }
    })();
  }

  async ensureSaved() {
    while (this.saveCounter > 0) {
      // 他のスレッドに処理を譲る
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  private migrateHotkeySettings(data: ConfigType): ConfigType {
    const COMBINATION_IS_NONE = "####";
    const loadedHotkeys = structuredClone(data.hotkeySettings);
    const hotkeysWithoutNewCombination = defaultHotkeySettings.map(
      (defaultHotkey) => {
        const loadedHotkey = loadedHotkeys.find(
          (loadedHotkey) => loadedHotkey.action === defaultHotkey.action
        );
        const hotkeyWithoutCombination: HotkeySetting = {
          action: defaultHotkey.action,
          combination: COMBINATION_IS_NONE,
        };
        return loadedHotkey || hotkeyWithoutCombination;
      }
    );
    const migratedHotkeys = hotkeysWithoutNewCombination.map((hotkey) => {
      if (hotkey.combination === COMBINATION_IS_NONE) {
        const newHotkey =
          defaultHotkeySettings.find(
            (defaultHotkey) => defaultHotkey.action === hotkey.action
          ) || hotkey; // ここの find が undefined を返すケースはないが、ts のエラーになるので入れた
        const combinationExists = hotkeysWithoutNewCombination.some(
          (hotkey) => hotkey.combination === newHotkey.combination
        );
        if (combinationExists) {
          const emptyHotkey: HotkeySetting = {
            action: newHotkey.action,
            combination: "",
          };
          return emptyHotkey;
        } else {
          return newHotkey;
        }
      } else {
        return hotkey;
      }
    });
    return {
      ...data,
      hotkeySettings: migratedHotkeys,
    };
  }
}
