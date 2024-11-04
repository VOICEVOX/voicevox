import path from "path";
import fs from "fs";
import shlex from "shlex";

import { dialog } from "electron"; // FIXME: ここでelectronをimportするのは良くない

import log from "electron-log/main";

import { getConfigManager } from "../electronConfig";
import {
  EngineInfo,
  EngineDirValidationResult,
  MinimumEngineManifestType,
  EngineId,
  minimumEngineManifestSchema,
} from "@/type/preload";
import { AltPortInfos } from "@/store/type";
import { loadEnvEngineInfos } from "@/domain/defaultEngine/envEngineInfo";

/**
 * デフォルトエンジンの情報を取得する
 */
function fetchDefaultEngineInfos(defaultEngineDir: string): EngineInfo[] {
  // TODO: envから直接ではなく、envに書いたengine_manifest.jsonから情報を得るようにする
  const engines = loadEnvEngineInfos();

  return engines.map((engineInfo) => {
    const { protocol, hostname, port, pathname } = new URL(engineInfo.host);
    return {
      ...engineInfo,
      protocol,
      hostname,
      defaultPort: port,
      pathname: pathname === "/" ? "" : pathname,
      isDefault: true,
      type: "path",
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
  defaultEngineDir: string;
  vvppEngineDir: string;

  /** 代替ポート情報 */
  public altPortInfos: AltPortInfos = {};

  constructor(payload: { defaultEngineDir: string; vvppEngineDir: string }) {
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
        protocol: "http:",
        hostname: "127.0.0.1",
        defaultPort: manifest.port.toString(),
        pathname: "",
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
    const configManager = getConfigManager();
    // FIXME: この関数の引数でregisteredEngineDirsを受け取り、動かないエンジンをreturnして、EngineManager外でconfig.setする
    for (const engineDir of configManager.get("registeredEngineDirs")) {
      const result = addEngine(engineDir, "path");
      if (result !== "ok") {
        log.log(`Failed to load engine: ${result}, ${engineDir}`);
        // 動かないエンジンは追加できないので削除
        // FIXME: エンジン管理UIで削除可能にする
        dialog.showErrorBox(
          "エンジンの読み込みに失敗しました。",
          `${engineDir}を読み込めませんでした。このエンジンは削除されます。`,
        );
        configManager.set(
          "registeredEngineDirs",
          configManager
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
      ...fetchDefaultEngineInfos(this.defaultEngineDir),
      ...this.fetchAdditionalEngineInfos(),
    ];
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
    this.altPortInfos[engineId] = port.toString();
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

let manager: EngineInfoManager | undefined;

export const initializeEngineInfoManager = (payload: {
  defaultEngineDir: string;
  vvppEngineDir: string;
}) => {
  manager = new EngineInfoManager(payload);
};

export const getEngineInfoManager = () => {
  if (manager == undefined) {
    throw new Error("EngineInfoManager is not initialized");
  }
  return manager;
};
