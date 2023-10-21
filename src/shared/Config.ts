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
