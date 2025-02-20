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
  private willReplaceEngineDirs: { from: string; to: string }[];

  private lock = new AsyncLock();

  constructor(params: { vvppEngineDir: string; tmpDir: string }) {
    this.vvppEngineDir = params.vvppEngineDir;
    this.tmpDir = params.tmpDir;
    this.willDeleteEngineIds = new Set();
    this.willReplaceEngineDirs = [];
  }

  markWillMove(from: string, to: string) {
    this.willReplaceEngineDirs.push({
      from,
      to: path.join(this.vvppEngineDir, to),
    });
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

  isEngineDirName(dir: string, manifest: MinimumEngineManifestType) {
    return dir.endsWith(`+${manifest.uuid}`);
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

  /**
   * 追加
   */
  async install(
    vvppPath: string,
    callbacks?: { onProgress?: ProgressCallback },
  ) {
    await this.lock.acquire(lockKey, () => this._install(vvppPath, callbacks));
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

    const dirName = this.toValidDirName(manifest);
    const engineDirectory = path.join(this.vvppEngineDir, dirName);
    const oldEngineDirName = (
      await fs.promises.readdir(this.vvppEngineDir)
    ).find((dir) => {
      return this.isEngineDirName(dir, manifest);
    });
    if (oldEngineDirName) {
      this.markWillMove(tmpEngineDir, dirName);
    } else {
      await moveFile(tmpEngineDir, engineDirectory);
    }
    if (!isWindows) {
      await fs.promises.chmod(
        path.join(engineDirectory, manifest.command),
        "755",
      );
    }
  }

  private buildTemporaryEngineDir(vvppEngineDir: string): string {
    const nonce = new Date().getTime().toString();
    return path.join(vvppEngineDir, ".tmp", nonce);
  }

  async handleMarkedEngineDirs() {
    await this.lock.acquire(lockKey, () => this._handleMarkedEngineDirs());
  }
  private async _handleMarkedEngineDirs() {
    await Promise.all(
      [...this.willDeleteEngineIds].map(async (engineId) => {
        let deletingEngineDir: string | undefined = undefined;
        for (const engineDir of await fs.promises.readdir(this.vvppEngineDir)) {
          if (engineDir.endsWith("+" + engineId)) {
            deletingEngineDir = path.join(this.vvppEngineDir, engineDir);
            break;
          }
        }
        if (deletingEngineDir == null) {
          throw new Error("エンジンが見つかりませんでした。");
        }

        for (let i = 0; i < 5; i++) {
          try {
            await fs.promises.rm(deletingEngineDir, {
              recursive: true,
              force: true,
            });
            log.info(`Engine ${engineId} deleted successfully.`);
            break;
          } catch (e) {
            if (i === 4) {
              log.error(e);
              dialog.showErrorBox(
                "エンジン削除エラー",
                `エンジンの削除に失敗しました。エンジンのフォルダを手動で削除してください。\n${deletingEngineDir}\nエラー内容: ${errorToMessage(e)}`,
              );
            } else {
              log.error("Failed to delete engine directory: ", e, ", retrying");
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        }
      }),
    );
    this.willDeleteEngineIds.clear();
    await Promise.all(
      [...this.willReplaceEngineDirs].map(async ({ from, to }) => {
        for (let i = 0; i < 5; i++) {
          try {
            await fs.promises.rm(to, { recursive: true });
            await moveFile(from, to);
            log.info(`Renamed ${from} to ${to}`);
            break;
          } catch (e) {
            if (i === 4) {
              log.error(e);
              dialog.showErrorBox(
                "エンジン追加エラー",
                `エンジンの追加に失敗しました。エンジンのフォルダを手動で移動してください。\n${from}\nエラー内容: ${errorToMessage(e)}`,
              );
            } else {
              log.error("Failed to rename engine directory: ", e, ", retrying");
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        }
      }),
    );
    this.willReplaceEngineDirs = [];
  }

  hasMarkedEngineDirs() {
    return (
      this.willReplaceEngineDirs.length > 0 || this.willDeleteEngineIds.size > 0
    );
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
