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
import { UnreachableError } from "@/type/utility";
import {
  EnvEngineInfoType,
  loadEnvEngineInfos,
} from "@/domain/defaultEngine/envEngineInfo";
import { failure, Result, success } from "@/type/result";

/** エンジンの情報を管理するクラス */
export class EngineInfoManager {
  defaultEngineDir: string;
  vvppEngineDir: string;

  /** 代替ポート情報 */
  public altPortInfos: AltPortInfos = {};

  private envEngineInfos = loadEnvEngineInfos();

  constructor(payload: { defaultEngineDir: string; vvppEngineDir: string }) {
    this.defaultEngineDir = payload.defaultEngineDir;
    this.vvppEngineDir = payload.vvppEngineDir;
  }

  /** エンジンディレクトリからエンジン情報を読み込む */
  private loadEngineInfo(
    engineDir: string,
    type: "vvpp" | "path",
  ): Result<EngineInfo, "manifestNotFound" | "manifestParseError"> {
    const manifestPath = path.join(engineDir, "engine_manifest.json");
    if (!fs.existsSync(manifestPath)) {
      return failure("manifestNotFound", new Error("manifest not found"));
    }
    let manifest: MinimumEngineManifestType;
    try {
      manifest = minimumEngineManifestSchema.parse(
        JSON.parse(fs.readFileSync(manifestPath, { encoding: "utf8" })),
      );
    } catch (e) {
      if (e instanceof Error) {
        return failure("manifestParseError", e);
      } else {
        throw new UnreachableError();
      }
    }

    const [command, ...args] = shlex.split(manifest.command);

    const engineInfo = {
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
    } satisfies EngineInfo;
    return success(engineInfo);
  }

  /**
   * VVPPエンジン情報の一覧を取得する。
   */
  private fetchVvppEngineInfos(): EngineInfo[] {
    const engineInfos: EngineInfo[] = [];
    for (const dirName of fs.readdirSync(this.vvppEngineDir)) {
      const engineDir = path.join(this.vvppEngineDir, dirName);
      if (!fs.statSync(engineDir).isDirectory()) {
        log.log(`${engineDir} is not directory`);
        continue;
      }
      if (dirName === ".tmp") {
        continue;
      }
      const result = this.loadEngineInfo(engineDir, "vvpp");
      if (!result.ok) {
        log.log(`Failed to load engine: ${result.code}, ${engineDir}`);
        continue;
      }
      engineInfos.push(result.value);
    }
    return engineInfos;
  }

  /**
   * 設定で登録したエンジン情報を取得する。
   * FIXME: store.get("registeredEngineDirs")への副作用をEngineManager外に移動する
   */
  private fetchRegisteredEngineInfos(): EngineInfo[] {
    const configManager = getConfigManager();

    const engineInfos: EngineInfo[] = [];
    for (const engineDir of configManager.get("registeredEngineDirs")) {
      const result = this.loadEngineInfo(engineDir, "path");
      if (!result.ok) {
        log.log(`Failed to load engine: ${result.code}, ${engineDir}`);
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
        continue;
      }
      engineInfos.push(result.value);
    }
    return engineInfos;
  }

  /**
   * デフォルトエンジンの情報を取得する
   */
  private fetchDefaultEngineInfos(
    envEngineInfos: EnvEngineInfoType[],
    defaultEngineDir: string,
  ): EngineInfo[] {
    // TODO: envから直接ではなく、envに書いたengine_manifest.jsonから情報を得るようにする
    return envEngineInfos
      .filter((engineInfo) => engineInfo.type != "downloadVvpp")
      .map((engineInfo) => {
        if (engineInfo.type == "downloadVvpp") throw new UnreachableError();
        const { protocol, hostname, port, pathname } = new URL(engineInfo.host);
        return {
          ...engineInfo,
          protocol,
          hostname,
          defaultPort: port,
          pathname: pathname === "/" ? "" : pathname,
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

  /**
   * 追加エンジンの一覧を取得する。
   */
  private fetchAdditionalEngineInfos(): EngineInfo[] {
    return [
      ...this.fetchVvppEngineInfos(), // FIXME: デフォルトエンジンを省く
      ...this.fetchRegisteredEngineInfos(),
    ];
  }

  /**
   * 全てのエンジンの一覧を取得する。デフォルトエンジン＋追加エンジン。
   */
  fetchEngineInfos(): EngineInfo[] {
    // TOOD: vvpp内にあるもの含むデフォルトエンジン一覧と、デフォルトエンジン以外の追加エンジン一覧を取得する関数に分ける
    const engineInfos = [
      ...this.fetchDefaultEngineInfos(
        this.envEngineInfos,
        this.defaultEngineDir,
      ),
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
   * 指定したエンジンの情報が存在するかどうかを判定する。
   */
  hasEngineInfo(engineId: EngineId): boolean {
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

export function initializeEngineInfoManager(payload: {
  defaultEngineDir: string;
  vvppEngineDir: string;
}) {
  manager = new EngineInfoManager(payload);
}

export function getEngineInfoManager() {
  if (manager == undefined) {
    throw new Error("EngineInfoManager is not initialized");
  }
  return manager;
}
