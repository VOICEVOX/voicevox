import semver from "semver";
import AsyncLock from "async-lock";
import {
  AcceptTermsStatus,
  ConfigType,
  EngineId,
  configSchema,
  DefaultStyleId,
  defaultHotkeySettings,
  HotkeySettingType,
  ExperimentalSettingType,
  HotkeyCombination,
  VoiceId,
  PresetKey,
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
        JSON.parse(import.meta.env.VITE_DEFAULT_ENGINE_INFOS)[0].uuid,
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
    ">=0.14.9",
    (config) => {
      // マルチエンジン機能を実験的機能から通常機能に
      const experimentalSetting =
        config.experimentalSetting as ExperimentalSettingType; // FIXME: parseするかasをやめる
      if (
        Object.prototype.hasOwnProperty.call(
          experimentalSetting,
          "enableMultiEngine",
        )
      ) {
        const enableMultiEngine: boolean =
          // @ts-expect-error 削除されたパラメータ。
          config.experimentalSetting.enableMultiEngine;
        config.enableMultiEngine = enableMultiEngine;
        // @ts-expect-error 削除されたパラメータ。
        delete config.experimentalSetting.enableMultiEngine;
      }
    },
  ],
  [
    ">=0.15",
    (config) => {
      // 一つだけ書き出し → 選択音声を書き出し
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
            : toolbarSetting,
        );
      config.toolbarSetting = newToolbarSetting;

      return config;
    },
  ],
  [
    ">=0.17",
    (config) => {
      // 書き出し先のディレクトリが空文字の場合書き出し先固定を無効化する
      // FIXME: 勝手に書き換えるのは少し不親切なので、ダイアログで書き換えたことを案内する
      const savingSetting = config.savingSetting as ConfigType["savingSetting"];
      if (
        savingSetting.fixedExportEnabled &&
        savingSetting.fixedExportDir === ""
      ) {
        savingSetting.fixedExportEnabled = false;
      }
    },
  ],
  [
    ">=0.19",
    (config) => {
      // ピッチ表示機能の設定をピッチ編集機能に引き継ぐ
      const experimentalSetting =
        config.experimentalSetting as ExperimentalSettingType & {
          showPitchInSongEditor?: boolean; // FIXME: TypeScript 5.4.5ならこの型の結合は不要
        };
      if (
        "showPitchInSongEditor" in experimentalSetting &&
        typeof experimentalSetting.showPitchInSongEditor === "boolean"
      ) {
        experimentalSetting.enablePitchEditInSongEditor =
          experimentalSetting.showPitchInSongEditor;
        delete experimentalSetting.showPitchInSongEditor;
      }
    },
  ],
  [
    ">=0.20",
    (config) => {
      // プロジェクト読み込み → プロジェクトを読み込む
      const hotkeySettings =
        config.hotkeySettings as ConfigType["hotkeySettings"];
      const newHotkeySettings: ConfigType["hotkeySettings"] =
        hotkeySettings.map((hotkeySetting) => {
          /// @ts-expect-error 名前変更なので合わない。
          if (hotkeySetting.action === "プロジェクト読み込み") {
            return {
              ...hotkeySetting,
              action: "プロジェクトを読み込む",
            };
          }
          /// @ts-expect-error 名前変更なので合わない。
          if (hotkeySetting.action === "テキスト読み込む") {
            return {
              ...hotkeySetting,
              action: "テキストを読み込む",
            };
          }
          return hotkeySetting;
        });
      config.hotkeySettings = newHotkeySettings;

      // バグで追加されたソング・ハミングスタイルのデフォルトプリセットを削除する
      (() => {
        const defaultPresetKeys = config.defaultPresetKeys as
          | ConfigType["defaultPresetKeys"]
          | undefined;
        if (
          defaultPresetKeys == undefined ||
          Object.keys(defaultPresetKeys).length == 0
        )
          return;

        const singStyleVoiceId: VoiceId[] = Object.keys(
          defaultPresetKeys,
        ).filter((voiceId) => {
          // VoiceIdの3番目はスタイルIDなので、それが3000以上3085以下または6000のものをソング・ハミングスタイルとみなす
          const splited = voiceId.split(":");
          if (splited.length < 3) return false;

          const styleId = parseInt(splited[2]);
          return (styleId >= 3000 && styleId <= 3085) || styleId === 6000;
        }) as VoiceId[];

        const presets = config.presets as ConfigType["presets"];
        const singerPresetKeys: PresetKey[] = [];
        for (const voiceId of singStyleVoiceId) {
          const defaultPresetKey = defaultPresetKeys[voiceId];
          if (defaultPresetKey == undefined) continue;
          singerPresetKeys.push(defaultPresetKey);
          delete presets.items[defaultPresetKey];
          delete defaultPresetKeys[voiceId];
        }

        if (singerPresetKeys.length === 0) return;
        const newPresetKeys = presets.keys.filter(
          (key) => !singerPresetKeys.includes(key),
        );
        presets.keys = newPresetKeys;
      })();

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

  public reset() {
    this.config = this.getDefaultConfig();
    this._save();
  }

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
      this._save();
    } else {
      this.reset();
    }
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
    this.lock.acquire(lockKey, async () => {
      await this.save({
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
    throw new Error("Failed to save config");
  }

  private migrateHotkeySettings(data: ConfigType): ConfigType {
    const COMBINATION_IS_NONE = HotkeyCombination("####");
    const loadedHotkeys = structuredClone(data.hotkeySettings);
    const hotkeysWithoutNewCombination = defaultHotkeySettings.map(
      (defaultHotkey) => {
        const loadedHotkey = loadedHotkeys.find(
          (loadedHotkey) => loadedHotkey.action === defaultHotkey.action,
        );
        const hotkeyWithoutCombination: HotkeySettingType = {
          action: defaultHotkey.action,
          combination: COMBINATION_IS_NONE,
        };
        return loadedHotkey || hotkeyWithoutCombination;
      },
    );
    const migratedHotkeys = hotkeysWithoutNewCombination.map((hotkey) => {
      if (hotkey.combination === COMBINATION_IS_NONE) {
        const newHotkey =
          defaultHotkeySettings.find(
            (defaultHotkey) => defaultHotkey.action === hotkey.action,
          ) || hotkey; // ここの find が undefined を返すケースはないが、ts のエラーになるので入れた
        const combinationExists = hotkeysWithoutNewCombination.some(
          (hotkey) => hotkey.combination === newHotkey.combination,
        );
        if (combinationExists) {
          const emptyHotkey: HotkeySettingType = {
            action: newHotkey.action,
            combination: HotkeyCombination(""),
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
