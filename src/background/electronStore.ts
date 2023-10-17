import { join } from "path";
import fs from "fs";
import { app, dialog, shell } from "electron";
import log from "electron-log";
import { z } from "zod";
import semver from "semver";
import {
  AcceptTermsStatus,
  ConfigType,
  EngineId,
  configSchema,
} from "@/type/preload";

const migrations: Record<string, (store: Store) => void> = {
  ">=0.13": (store) => {
    // acceptTems -> acceptTerms
    const prevIdentifier = "acceptTems";
    // @ts-expect-error 削除されたパラメータ。
    const prevValue = store.get(prevIdentifier, undefined) as
      | AcceptTermsStatus
      | undefined;
    if (prevValue) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store.delete(prevIdentifier as any);
      store.set("acceptTerms", prevValue);
    }
  },
  ">=0.14": (store) => {
    // FIXME: できるならEngineManagerからEngineIDを取得したい
    if (import.meta.env.VITE_DEFAULT_ENGINE_INFOS == undefined)
      throw new Error("VITE_DEFAULT_ENGINE_INFOS == undefined");
    const engineId = EngineId(
      JSON.parse(import.meta.env.VITE_DEFAULT_ENGINE_INFOS)[0].uuid
    );
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
};

export class Store {
  private data: ConfigType;

  constructor() {
    if (fs.existsSync(this.path)) {
      const data = JSON.parse(fs.readFileSync(this.path, "utf-8"));
      const version = data.__internal__.migrations.version;
      this.data = data;
      for (const [versionRange, migration] of Object.entries(migrations)) {
        if (!semver.satisfies(version, versionRange)) {
          migration(this);
        }
      }
      this.data = configSchema.parse(this.data);
    } else {
      const defaultConfig = configSchema.parse({});
      this.data = defaultConfig;
    }
    this.save();
  }

  get path(): string {
    return join(app.getPath("userData"), "config.json");
  }

  public get<K extends keyof ConfigType>(key: K): ConfigType[K] {
    return this.data[key];
  }

  public set<K extends keyof ConfigType>(key: K, value: ConfigType[K]): void {
    this.data[key] = value;
    this.save();
  }

  public delete(key: keyof ConfigType): void {
    delete this.data[key];
    this.save();
  }

  save(): void {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(
      this.path,
      JSON.stringify(
        {
          ...configSchema.parse(this.data),
          __internal__: {
            migrations: {
              version: app.getVersion(),
            },
          },
        },

        null,
        2
      )
    );
  }
}

let store: Store | undefined;

function getStore() {
  if (!store) {
    store = new Store();
  }
  return store;
}

export function getStoreWithError(): Store {
  try {
    return getStore();
  } catch (e) {
    log.error(e);
    app.whenReady().then(() => {
      dialog
        .showMessageBox({
          type: "error",
          title: "設定ファイルの読み込みエラー",
          message: `設定ファイルの読み込みに失敗しました。${app.getPath(
            "userData"
          )} にある config.json の名前を変えることで解決することがあります（ただし設定がすべてリセットされます）。設定ファイルがあるフォルダを開きますか？`,
          buttons: ["いいえ", "はい"],
          noLink: true,
          cancelId: 0,
        })
        .then(async ({ response }) => {
          if (response === 1) {
            await shell.openPath(app.getPath("userData"));
            // 直後にexitするとフォルダが開かないため
            await new Promise((resolve) => {
              setTimeout(resolve, 500);
            });
          }
        })
        .finally(() => {
          app.exit(1);
        });
    });
    throw e;
  }
}
