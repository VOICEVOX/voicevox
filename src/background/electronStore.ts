import { join } from "path";
import fs from "fs";
import { app, dialog, shell } from "electron";
import log from "electron-log";
import { z } from "zod";
import semver from "semver";
import {
  AcceptTermsStatus,
  SettingsStoreType,
  EngineId,
  settingsStoreSchema,
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
    // FIXME: できるならEngineManagerからEnginIDを取得したい
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
    const engineSettings: SettingsStoreType["engineSettings"] = {};
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
const configJsonSchema = settingsStoreSchema.extend({
  __internal__: z.object({
    migrations: z.object({
      version: z.string(),
    }),
  }),
});

export class Store {
  private data: SettingsStoreType;

  constructor() {
    const data = fs.existsSync(this.path)
      ? JSON.parse(fs.readFileSync(this.path, "utf-8"))
      : configJsonSchema.parse({});
    const version = data.__internal__.migrations.version || app.getVersion();
    this.data = data;
    for (const [versionRange, migration] of Object.entries(migrations)) {
      if (!semver.satisfies(version, versionRange)) {
        migration(this);
      }
    }
    this.save();
  }

  get path(): string {
    return join(app.getPath("userData"), "config.json");
  }

  public get<K extends keyof SettingsStoreType>(
    key: K,
    defaultValue?: SettingsStoreType[K]
  ): SettingsStoreType[K] {
    return this.data[key] ?? defaultValue;
  }

  public set<K extends keyof SettingsStoreType>(
    key: K,
    value: SettingsStoreType[K]
  ): void {
    this.data[key] = value;
    this.save();
  }

  public delete(key: keyof SettingsStoreType): void {
    delete this.data[key];
    this.save();
  }

  save(): void {
    fs.writeFileSync(
      this.path,
      JSON.stringify(
        configJsonSchema.parse({
          ...this.data,
          __internal__: { migrations: { version: app.getVersion() } },
        }),
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
