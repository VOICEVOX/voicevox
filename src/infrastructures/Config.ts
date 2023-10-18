import semver from "semver";
import {
  AcceptTermsStatus,
  ConfigType,
  EngineId,
  configSchema,
} from "@/type/preload";

const migrations: [string, (store: Config) => void][] = [
  [
    ">=0.13",
    (store) => {
      // acceptTems -> acceptTerms
      const prevIdentifier = "acceptTems";
      // @ts-expect-error 削除されたパラメータ。
      const prevValue = store.get(prevIdentifier, undefined) as
        | AcceptTermsStatus
        | undefined;
      if (prevValue) {
        // @ts-expect-error 削除されたパラメータ。
        store.delete(prevIdentifier);
        store.set("acceptTerms", prevValue);
      }
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
      const prevDefaultStyleIds = store.get("defaultStyleIds");
      store.set(
        "defaultStyleIds",
        prevDefaultStyleIds.map((defaultStyle) => ({
          engineId,
          speakerUuid: defaultStyle.speakerUuid,
          defaultStyleId: defaultStyle.defaultStyleId,
        }))
      );

      const outputSamplingRate: number =
        // @ts-expect-error 削除されたパラメータ。
        store.get("savingSetting").outputSamplingRate;
      const engineSettings: ConfigType["engineSettings"] = {};
      engineSettings[engineId] = {
        // @ts-expect-error 削除されたパラメータ。
        useGpu: store.get("useGpu"),
        outputSamplingRate:
          outputSamplingRate === 24000 ? "engineDefault" : outputSamplingRate,
      };
      store.set("engineSettings", engineSettings);

      const savingSetting = store.get("savingSetting");
      // @ts-expect-error 削除されたパラメータ。
      delete savingSetting.outputSamplingRate;
      store.set("savingSetting", savingSetting);

      // @ts-expect-error 削除されたパラメータ。
      store.delete("useGpu");
    },
  ],
];

export abstract class Config {
  protected data: ConfigType;

  abstract configExists(): boolean;
  abstract loadConfig(): Record<string, unknown> & {
    __internal__: { migrations: { version: string } };
  };
  abstract save(data: ConfigType): void;

  constructor() {
    if (this.configExists()) {
      const data = this.loadConfig();
      const version = data.__internal__.migrations.version;
      // とりあえずConfigTypeにキャストしておく。バリデーションは下で行っているので問題ないはず。
      this.data = data as unknown as ConfigType;
      for (const [versionRange, migration] of migrations) {
        if (!semver.satisfies(version, versionRange)) {
          migration(this);
        }
      }
      this.data = configSchema.parse(this.data);
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

  public delete(key: keyof ConfigType): void {
    delete this.data[key];
    this._save();
  }

  private _save(): void {
    this.save(
      configSchema.parse({
        ...this.data,
        __internal__: {
          migrations: {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            version: process.env.APP_VERSION!,
          },
        },
      })
    );
  }
}
