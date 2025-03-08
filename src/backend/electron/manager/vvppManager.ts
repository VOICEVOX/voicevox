import fs from "node:fs";
import path from "node:path";
import { moveFile } from "move-file";
import { dialog } from "electron";
import AsyncLock from "async-lock";
import {
  EngineId,
  EngineInfo,
  MinimumEngineManifestType,
} from "@/type/preload";
import { errorToMessage } from "@/helpers/errorHelper";
import { VvppFileExtractor } from "@/backend/electron/vvppFile";
import { ProgressCallback } from "@/helpers/progressHelper";
import { createLogger } from "@/helpers/log";
import { isWindows } from "@/helpers/platform";

const log = createLogger("VvppManager");

export const isVvppFile = (filePath: string) => {
  return (
    path.extname(filePath) === ".vvpp" || path.extname(filePath) === ".vvppp"
  );
};

const lockKey = "lock-key-for-vvpp-manager";

type MoveParams = { from: string; to: string; engineId: EngineId };

// # 軽い概要
//
// フォルダ名："エンジン名+UUID"
// エンジン名にフォルダ名に使用できない文字が含まれている場合は"_"に置換する。連続する"_"は1つにする。
// 拡張子は".vvpp"または".vvppp"。".vvppp"は分割されているファイルであることを示す。
// engine.0.vvppp、engine.1.vvppp、engine.2.vvppp、...というように分割されている。
// UUIDはengine_manifest.jsonのuuidを使用し、同一エンジンの判定にはこれを使用する。
//
// 追加：
// * エンジンを仮フォルダ（vvpp-engines/.tmp/現在の時刻）に展開する
// * エンジンが既に存在しているか確認する
//   - 存在していた場合：上書き処理を行う
//   - 存在していなかった場合：仮フォルダをvvpp-engines/エンジン名+UUIDに移動する
//
// 上書き：
// * アプリ終了時に古いVVPPディレクトリを消去するように予約する
// * アプリ終了時に新しいVVPPディレクトリをリネームするように予約する
// * アプリ終了時、予約されていた処理を行う
//
// 削除：
// * アプリ終了時にVVPPディレクトリを消去するように予約する
// * アプリ終了時、予約されていた処理を行う
//
// エンジンを停止してからではないとディレクトリを削除できないため、このような実装になっている。
export class VvppManager {
  private vvppEngineDir: string;
  private tmpDir: string;

  private willDeleteEngineIds: Set<EngineId>;
  private willMoveEngineDirs: MoveParams[];

  private lock = new AsyncLock();

  constructor(params: { vvppEngineDir: string; tmpDir: string }) {
    this.vvppEngineDir = params.vvppEngineDir;
    this.tmpDir = params.tmpDir;
    this.willDeleteEngineIds = new Set();
    this.willMoveEngineDirs = [];
  }

  markWillMove(params: MoveParams) {
    this.willMoveEngineDirs.push(params);
  }

  markWillDelete(engineId: EngineId) {
    this.willDeleteEngineIds.add(engineId);
  }

  toValidDirName(manifest: MinimumEngineManifestType) {
    // フォルダに使用できない文字が含まれている場合は置換する
    return `${manifest.name.replace(/[\s<>:"/\\|?*]+/g, "_")}+${manifest.uuid}`;
  }

  buildEngineDirPath(manifest: MinimumEngineManifestType) {
    return path.join(this.vvppEngineDir, this.toValidDirName(manifest));
  }

  isEngineDirName(dir: string, engineId: EngineId) {
    return dir.endsWith(`+${engineId}`);
  }

  async getInstalledEngineDir(engineId: EngineId) {
    const dirNames = (await fs.promises.readdir(this.vvppEngineDir)).filter(
      (dir) => this.isEngineDirName(dir, engineId),
    );
    if (dirNames.length > 1) {
      throw new Error("Multiple installed engine directories found.");
    } else if (dirNames.length == 0) {
      return undefined;
    }
    return path.join(this.vvppEngineDir, dirNames[0]);
  }

  canUninstall(engineInfo: EngineInfo) {
    const engineId = engineInfo.uuid;

    if (engineInfo.type !== "vvpp") {
      log.error(`engineInfo.type is not vvpp: engineId == ${engineId}`);
      return false;
    }

    const engineDirectory = engineInfo.path;
    if (engineDirectory == null) {
      log.error(`engineDirectory is null: engineId == ${engineId}`);
      return false;
    }

    return true;
  }

  private async withLockAcquired(fn: () => Promise<void>) {
    await this.lock.acquire(lockKey, () => fn());
  }

  /**
   * 追加
   */
  async install(
    vvppPath: string,
    callbacks?: { onProgress?: ProgressCallback },
  ) {
    await this.withLockAcquired(() => this._install(vvppPath, callbacks));
  }
  private async _install(
    vvppPath: string,
    callbacks?: { onProgress?: ProgressCallback },
  ) {
    const tmpEngineDir = this.buildTemporaryEngineDir(this.vvppEngineDir);
    log.info("Extracting vvpp to", tmpEngineDir);

    const manifest = await new VvppFileExtractor({
      vvppLikeFilePath: vvppPath,
      outputDir: tmpEngineDir,
      tmpDir: this.tmpDir,
      callbacks,
    }).extract();

    await this.applyExecutablePermissions(tmpEngineDir, manifest.command);

    const hasOldEngine = await this.hasOldEngine(manifest.uuid);
    const engineDir = this.buildEngineDirPath(manifest);
    if (hasOldEngine) {
      this.markWillMove({
        from: tmpEngineDir,
        to: engineDir,
        engineId: manifest.uuid,
      });
    } else {
      await moveFile(tmpEngineDir, engineDir);
    }
  }

  private buildTemporaryEngineDir(vvppEngineDir: string): string {
    const nonce = new Date().getTime().toString();
    return path.join(vvppEngineDir, ".tmp", nonce);
  }

  private async applyExecutablePermissions(
    engineDirectory: string,
    commandPath: string,
  ) {
    if (!isWindows) {
      await fs.promises.chmod(path.join(engineDirectory, commandPath), "755");
    }
  }

  private async hasOldEngine(engineId: EngineId) {
    return (await this.getInstalledEngineDir(engineId)) != undefined;
  }

  async handleMarkedEngineDirs() {
    await this.withLockAcquired(() => this._handleMarkedEngineDirs());
  }
  private async _handleMarkedEngineDirs() {
    await Promise.all(
      [...this.willDeleteEngineIds].map(async (engineId) => {
        const deletingEngineDir = await this.getInstalledEngineDir(engineId);
        if (deletingEngineDir == undefined) {
          throw new Error("エンジンが見つかりませんでした。");
        }

        try {
          await deleteDirWithRetry(deletingEngineDir);
          log.info(`Engine ${engineId} deleted successfully.`);
        } catch (e) {
          log.error("Failed to delete engine directory: ", e);
          dialog.showErrorBox(
            "エンジン削除エラー",
            `エンジンの削除に失敗しました。エンジンのフォルダを手動で削除してください。\n${deletingEngineDir}\nエラー内容: ${errorToMessage(e)}`,
          );
        }
      }),
    );
    this.willDeleteEngineIds.clear();

    await Promise.all(
      [...this.willMoveEngineDirs].map(async ({ from, to, engineId }) => {
        const deletingEngineDir = await this.getInstalledEngineDir(engineId);
        if (deletingEngineDir == undefined) {
          throw new Error("エンジンが見つかりませんでした。");
        }

        try {
          await deleteDirWithRetry(deletingEngineDir);
          log.info(`Engine ${engineId} deleted successfully.`);

          await moveFileWithRetry({ from, to });
          log.info(`Renamed ${from} to ${to}`);
        } catch (e) {
          log.error("Failed to rename engine directory: ", e);
          dialog.showErrorBox(
            "エンジン追加エラー",
            `エンジンの追加に失敗しました。エンジンのフォルダを手動で移動してください。\n${from} -> ${to}\nエラー内容: ${errorToMessage(e)}`,
          );
        }
      }),
    );
    this.willMoveEngineDirs = [];
  }

  hasMarkedEngineDirs() {
    return (
      this.willMoveEngineDirs.length > 0 || this.willDeleteEngineIds.size > 0
    );
  }
}

async function deleteDirWithRetry(dir: string) {
  await retry(() =>
    fs.promises.rm(dir, {
      recursive: true,
      force: true,
    }),
  );
}

async function moveFileWithRetry(params: { from: string; to: string }) {
  const { from, to } = params;
  await retry(() => moveFile(from, to));
}

async function retry(fn: () => Promise<void>) {
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fn();
      break;
    } catch (e) {
      if (i === maxRetries - 1) {
        throw e;
      } else {
        log.warn(`Retrying... (${i + 1}/${maxRetries}):`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
}

export default VvppManager;

let manager: VvppManager | undefined;

export function initializeVvppManager(params: {
  vvppEngineDir: string;
  tmpDir: string;
}) {
  manager = new VvppManager(params);
}

export function getVvppManager() {
  if (manager == undefined) {
    throw new Error("EngineInfoManager is not initialized");
  }
  return manager;
}
