import semver from "semver";
import AsyncLock from "async-lock";
import {
  AcceptTermsStatus,
  ConfigType,
  EngineId,
  configSchema,
  DefaultStyleId,
  defaultHotkeySettings,
  HotkeySetting,
} from "@/type/preload";

const lockKey = "save";

const migrations: [string, (store: Record<string, unknown>) => unknown][] = [
  [
    ">=0.13",
    (config) => {
      // acceptTems -> acceptTerms
      const prevIdentifier = "acceptTems";
      const prevValue = config[prevIdentifier] as AcceptTermsStatus | undefined;
      if (prevValue) {
        delete config[prevIdentifier];
        config.acceptTerms = prevValue;
      }

      return config;
    },
  ],
  [
    ">=0.14",
    (config) => {
      // FIXME: できるならEngineManagerからEngineIDを取得したい
      if (import.meta.env.VITE_DEFAULT_ENGINE_INFOS == undefined) {
        throw new Error("VITE_DEFAULT_ENGINE_INFOS == undefined");
      }
      const engineId = EngineId(
        JSON.parse(import.meta.env.VITE_DEFAULT_ENGINE_INFOS)[0].uuid
      );
      if (engineId == undefined)
        throw new Error("VITE_DEFAULT_ENGINE_INFOS[0].uuid == undefined");
      const prevDefaultStyleIds = config.defaultStyleIds as DefaultStyleId[];
      config.defaultStyleIds = prevDefaultStyleIds.map((defaultStyle) => ({
        engineId,
        speakerUuid: defaultStyle.speakerUuid,
        defaultStyleId: defaultStyle.defaultStyleId,
      }));

      const outputSamplingRate: number = (
        config.savingSetting as { outputSamplingRate: number }
      ).outputSamplingRate;
      const engineSettings: ConfigType["engineSettings"] = {};
      engineSettings[engineId] = {
        useGpu: config.useGpu as boolean,
        outputSamplingRate:
          outputSamplingRate === 24000 ? "engineDefault" : outputSamplingRate,
      };
      config.engineSettings = engineSettings;

      const savingSetting = config.savingSetting as ConfigType["savingSetting"];
      // @ts-expect-error 削除されたパラメータ。
      delete savingSetting.outputSamplingRate;
      config.savingSetting = savingSetting;

      delete config.useGpu;

      return config;
    },
  ],
  [
    ">=0.15",
    (config) => {
      const hotkeySettings =
        config.hotkeySettings as ConfigType["hotkeySettings"];
      const newHotkeySettings: ConfigType["hotkeySettings"] =
        hotkeySettings.map((hotkeySetting) => {
          /// @ts-expect-error 名前変更なので合わない。
          if (hotkeySetting.action === "一つだけ書き出し") {
            return {
              ...hotkeySetting,
              action: "選択音声を書き出し",
            };
          }
          return hotkeySetting;
        });
      config.hotkeySettings = newHotkeySettings;

      const toolbarSetting =
        config.toolbarSetting as ConfigType["toolbarSetting"];
      const newToolbarSetting: ConfigType["toolbarSetting"] =
        toolbarSetting.map((toolbarSetting) =>
          // @ts-expect-error 名前変更なので合わない。
          toolbarSetting === "EXPORT_AUDIO_ONE"
            ? "EXPORT_AUDIO_SELECTED"
            : toolbarSetting
        );
      config.toolbarSetting = newToolbarSetting;

      return config;
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
 * 設定管理の基底クラス
 *
 * # ロジックメモ
 * 保存呼び出しのカウンターを用意する。
 * set（save）が呼ばれる度、カウンターをインクリメントし、保存のPromiseをspawnする。
 *
 * 必ず保存されることを保証したい時（アプリ終了時など）は、await ensureSaved()を呼ぶ。
 */
export abstract class BaseConfigManager {
  protected config: ConfigType | undefined;

  private lock = new AsyncLock();

  protected abstract exists(): Promise<boolean>;
  protected abstract load(): Promise<Record<string, unknown> & Metadata>;
  protected abstract save(config: ConfigType & Metadata): Promise<void>;

  protected abstract getAppVersion(): string;

  public async initialize(): Promise<this> {
    if (await this.exists()) {
      const data = await this.load();
      const version = data.__internal__.migrations.version;
      for (const [versionRange, migration] of migrations) {
        if (!semver.satisfies(version, versionRange)) {
          migration(data);
        }
      }
      this.config = this.migrateHotkeySettings(configSchema.parse(data));
    } else {
      this.config = this.getDefaultConfig();
    }
    this._save();
    await this.ensureSaved();

    return this;
  }

  public get<K extends keyof ConfigType>(key: K): ConfigType[K] {
    if (!this.config) throw new Error("Config is not initialized");
    return this.config[key];
  }

  public set<K extends keyof ConfigType>(key: K, value: ConfigType[K]) {
    if (!this.config) throw new Error("Config is not initialized");
    this.config[key] = value;
    this._save();
  }

  private _save() {
    this.lock.acquire(lockKey, () => {
      this.save({
        ...configSchema.parse({
          ...this.config,
        }),
        __internal__: {
          migrations: {
            version: this.getAppVersion(),
          },
        },
      });
    });
  }

  ensureSaved(): Promise<void> | "alreadySaved" {
    if (!this.lock.isBusy(lockKey)) {
      return "alreadySaved";
    }

    return this._ensureSaved();
  }

  private async _ensureSaved(): Promise<void> {
    // 10秒待っても保存が終わらなかったら諦める
    for (let i = 0; i < 100; i++) {
      // 他のスレッドに処理を譲る
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (!this.lock.isBusy(lockKey)) {
        return;
      }
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

  protected getDefaultConfig(): ConfigType {
    return configSchema.parse({});
  }
}
