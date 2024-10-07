import path from "path";
import fs from "fs";
import shlex from "shlex";

import { dialog } from "electron"; // FIXME: ここでelectronをimportするのは良くない

import log from "electron-log/main";

import {
  EngineInfo,
  EngineDirValidationResult,
  MinimumEngineManifestType,
  EngineId,
  minimumEngineManifestSchema,
} from "@/type/preload";
import { AltPortInfos } from "@/store/type";
import { BaseConfigManager } from "@/backend/common/ConfigManager";
import {
  EnvEngineInfo,
  loadEnvEngineInfos,
} from "@/backend/common/envEngineInfoSchema";
import { UnreachableError } from "@/type/utility";

/**
 * デフォルトエンジンの情報を取得する
 */
function fetchDefaultEngineInfos(
  envEngineInfos: EnvEngineInfo[],
  defaultEngineDir: string,
): EngineInfo[] {
  // TODO: envから直接ではなく、envに書いたengine_manifest.jsonから情報を得るようにする
  return envEngineInfos
    .filter((engineInfo) => engineInfo.type != "downloadVvpp")
    .map((engineInfo) => {
      if (engineInfo.type == "downloadVvpp") throw new UnreachableError();
      return {
        ...engineInfo,
        isDefault: true,
        type: engineInfo.type,
        executionFilePath: path.resolve(engineInfo.executionFilePath),
        path:
          engineInfo.path == undefined
            ? undefined
            : path.resolve(defaultEngineDir, engineInfo.path),
      } satisfies EngineInfo;
    });
}

/** エンジンの情報を管理するクラス */
export class EngineInfoManager {
  configManager: BaseConfigManager;
  defaultEngineDir: string;
  vvppEngineDir: string;

  /** 代替ポート情報 */
  public altPortInfos: AltPortInfos = {};

  private envEngineInfos = loadEnvEngineInfos();

  constructor(payload: {
    configManager: BaseConfigManager;
    defaultEngineDir: string;
    vvppEngineDir: string;
  }) {
    this.configManager = payload.configManager;
    this.defaultEngineDir = payload.defaultEngineDir;
    this.vvppEngineDir = payload.vvppEngineDir;
  }

  /**
   * 追加エンジンの一覧を取得する。
   * FIXME: store.get("registeredEngineDirs")への副作用をEngineManager外に移動する
   */
  private fetchAdditionalEngineInfos(): EngineInfo[] {
    const engines: EngineInfo[] = [];
    const addEngine = (engineDir: string, type: "vvpp" | "path") => {
      const manifestPath = path.join(engineDir, "engine_manifest.json");
      if (!fs.existsSync(manifestPath)) {
        return "manifestNotFound";
      }
      let manifest: MinimumEngineManifestType;
      try {
        manifest = minimumEngineManifestSchema.parse(
          JSON.parse(fs.readFileSync(manifestPath, { encoding: "utf8" })),
        );
      } catch (e) {
        return "manifestParseError";
      }

      const [command, ...args] = shlex.split(manifest.command);

      engines.push({
        uuid: manifest.uuid,
        host: `http://127.0.0.1:${manifest.port}`,
        name: manifest.name,
        path: engineDir,
        executionEnabled: true,
        executionFilePath: path.join(engineDir, command),
        executionArgs: args,
        type,
        isDefault: false,
      } satisfies EngineInfo);
      return "ok";
    };
    for (const dirName of fs.readdirSync(this.vvppEngineDir)) {
      const engineDir = path.join(this.vvppEngineDir, dirName);
      if (!fs.statSync(engineDir).isDirectory()) {
        log.log(`${engineDir} is not directory`);
        continue;
      }
      if (dirName === ".tmp") {
        continue;
      }
      const result = addEngine(engineDir, "vvpp");
      if (result !== "ok") {
        log.log(`Failed to load engine: ${result}, ${engineDir}`);
      }
    }
    // FIXME: この関数の引数でregisteredEngineDirsを受け取り、動かないエンジンをreturnして、EngineManager外でconfig.setする
    for (const engineDir of this.configManager.get("registeredEngineDirs")) {
      const result = addEngine(engineDir, "path");
      if (result !== "ok") {
        log.log(`Failed to load engine: ${result}, ${engineDir}`);
        // 動かないエンジンは追加できないので削除
        // FIXME: エンジン管理UIで削除可能にする
        dialog.showErrorBox(
          "エンジンの読み込みに失敗しました。",
          `${engineDir}を読み込めませんでした。このエンジンは削除されます。`,
        );
        this.configManager.set(
          "registeredEngineDirs",
          this.configManager
            .get("registeredEngineDirs")
            .filter((p) => p !== engineDir),
        );
      }
    }
    return engines;
  }

  /**
   * 全てのエンジンの一覧を取得する。デフォルトエンジン＋追加エンジン。
   */
  fetchEngineInfos(): EngineInfo[] {
    const engineInfos = [
      ...fetchDefaultEngineInfos(this.envEngineInfos, this.defaultEngineDir),
      ...this.fetchAdditionalEngineInfos(),
    ];

    // 追加エンジンがダウンロードしたデフォルトエンジンと同じなら、デフォルトエンジンとして扱う
    const targetEngineUuids = this.envEngineInfos
      .filter((e) => e.type == "downloadVvpp")
      .map((e) => e.uuid);
    for (const engineInfo of engineInfos) {
      if (targetEngineUuids.includes(engineInfo.uuid)) {
        if (engineInfo.type != "vvpp") {
          log.warn(
            `Engine ${engineInfo.uuid} is same as default engine, but type is "${engineInfo.type}"`,
          );
        }
        engineInfo.isDefault = true;
      }
    }

    // 代替ポートに置き換える
    engineInfos.forEach((engineInfo) => {
      const altPortInfo = this.altPortInfos[engineInfo.uuid];
      if (altPortInfo) {
        const url = new URL(engineInfo.host);
        url.port = altPortInfo.to.toString();
        engineInfo.host = url.origin;
      }
    });
    return engineInfos;
  }

  /**
   * エンジンの情報を取得する。存在しない場合はエラーを返す。
   */
  fetchEngineInfo(engineId: EngineId): EngineInfo {
    const engineInfos = this.fetchEngineInfos();
    const engineInfo = engineInfos.find(
      (engineInfo) => engineInfo.uuid === engineId,
    );
    if (!engineInfo) {
      throw new Error(`No such engineInfo registered: engineId == ${engineId}`);
    }
    return engineInfo;
  }

  /**
   * 指定したエンジンが存在するかどうかを判定する。
   */
  hasEngine(engineId: EngineId): boolean {
    const engineInfos = this.fetchEngineInfos();
    return engineInfos.some((engineInfo) => engineInfo.uuid === engineId);
  }

  /**
   * エンジンのディレクトリを取得する。存在しない場合はエラーを返す。
   */
  fetchEngineDirectory(engineId: EngineId): string {
    const engineInfo = this.fetchEngineInfo(engineId);
    const engineDirectory = engineInfo.path;
    if (engineDirectory == undefined) {
      throw new Error(`engineDirectory is undefined: engineId == ${engineId}`);
    }

    return engineDirectory;
  }

  /**
   * AltPortInfoを初期化する。
   */
  initializeAltPortInfo() {
    this.altPortInfos = {};
  }

  /**
   * 代替ポート情報を更新する。
   * エンジン起動時にポートが競合して代替ポートを使う場合に使用する。
   */
  updateAltPort(engineId: EngineId, port: number) {
    const engineInfo = this.fetchEngineInfo(engineId);
    const url = new URL(engineInfo.host);
    this.altPortInfos[engineId] = {
      from: Number(url.port),
      to: port,
    };
  }

  /**
   * ディレクトリがエンジンとして正しいかどうかを判定する
   */
  validateEngineDir(engineDir: string): EngineDirValidationResult {
    if (!fs.existsSync(engineDir)) {
      return "directoryNotFound";
    } else if (!fs.statSync(engineDir).isDirectory()) {
      return "notADirectory";
    } else if (!fs.existsSync(path.join(engineDir, "engine_manifest.json"))) {
      return "manifestNotFound";
    }
    const manifest = fs.readFileSync(
      path.join(engineDir, "engine_manifest.json"),
      "utf-8",
    );
    let manifestContent: MinimumEngineManifestType;
    try {
      manifestContent = minimumEngineManifestSchema.parse(JSON.parse(manifest));
    } catch (e) {
      return "invalidManifest";
    }

    const engineInfos = this.fetchEngineInfos();
    if (
      engineInfos.some((engineInfo) => engineInfo.uuid === manifestContent.uuid)
    ) {
      return "alreadyExists";
    }
    return "ok";
  }
}

export default EngineInfoManager;
