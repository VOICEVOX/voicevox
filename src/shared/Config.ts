import semver from "semver";
import {
  AcceptTermsStatus,
  ConfigType,
  EngineId,
  configSchema,
  DefaultStyleId,
} from "@/type/preload";

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

type Metadata = {
  __internal__: {
    migrations: {
      version: string;
    };
  };
};

export abstract class BaseConfig {
  protected data: ConfigType;

  abstract exists(): boolean;
  abstract load(): Record<string, unknown> & Metadata;
  abstract save(data: ConfigType & Metadata): void;

  abstract getAppVersion(): string;

  constructor() {
    if (this.exists()) {
      const data = this.load();
      const version = data.__internal__.migrations.version;
      for (const [versionRange, migration] of migrations) {
        if (!semver.satisfies(version, versionRange)) {
          migration(data);
        }
      }
      this.data = configSchema.parse(data);
    } else {
      const defaultConfig = configSchema.parse({});
      this.data = defaultConfig;
    }
    this._save();
  }

  public get<K extends keyof ConfigType>(key: K): ConfigType[K] {
    return this.data[key];
  }

  public set<K extends keyof ConfigType>(key: K, value: ConfigType[K]): void {
    this.data[key] = value;
    this._save();
  }

  private _save(): void {
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
  }
}
