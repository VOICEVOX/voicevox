import fs from "fs";
import path from "path";
import log from "electron-log";
import { moveFile } from "move-file";
import { Extract } from "unzipper";
import { dialog } from "electron";
import { EngineInfo, MinimumEngineManifest } from "@/type/preload";
import MultiStream from "multistream";
import glob, { glob as callbackGlob } from "glob";

const isNotWin = process.platform !== "win32";

// globのPromise化
const globAsync = (pattern: string, options?: glob.IOptions) => {
  return new Promise<string[]>((resolve, reject) => {
    callbackGlob(pattern, options || {}, (err, matches) => {
      if (err) {
        reject(err);
      } else {
        resolve(matches);
      }
    });
  });
};

// # 軽い概要
//
// フォルダ名："エンジン名+UUID"
// エンジン名にフォルダ名に使用できない文字が含まれている場合は"_"に置換する。連続する"_"は1つにする。
// UUIDはengine_manifest.jsonのuuidを使用する
//
// 追加：
// * エンジンを仮フォルダ（vvpp-engines/.tmp/現在の時刻）に展開する
// * エンジンが既に存在しているか確認する
//   最後のUUIDで比較する
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
  vvppEngineDir: string;

  willDeleteEngineIds: Set<string>;
  willReplaceEngineDirs: Array<{ from: string; to: string }>;

  constructor({ vvppEngineDir }: { vvppEngineDir: string }) {
    this.vvppEngineDir = vvppEngineDir;
    this.willDeleteEngineIds = new Set();
    this.willReplaceEngineDirs = [];
  }

  markWillMove(from: string, to: string) {
    this.willReplaceEngineDirs.push({
      from,
      to: path.join(this.vvppEngineDir, to),
    });
  }

  markWillDelete(engineId: string) {
    this.willDeleteEngineIds.add(engineId);
  }

  toValidDirName(manifest: MinimumEngineManifest) {
    // フォルダに使用できない文字が含まれている場合は置換する
    return `${manifest.name.replace(/[\s<>:"/\\|?*]+/g, "_")}+${manifest.uuid}`;
  }

  isEngineDirName(dir: string, manifest: MinimumEngineManifest) {
    return dir.endsWith(`+${manifest.uuid}`);
  }

  canUninstall(engineInfo: EngineInfo) {
    const engineId = engineInfo.uuid;

    if (engineInfo.type !== "vvpp") {
      log.error(`No such engineInfo registered: engineId == ${engineId}`);
      return false;
    }

    const engineDirectory = engineInfo.path;
    if (engineDirectory == null) {
      log.error(`engineInfo.type is not vvpp: engineId == ${engineId}`);
      return false;
    }

    return true;
  }

  async extractVvpp(
    vvppPath: string
  ): Promise<{ outputDir: string; manifest: MinimumEngineManifest }> {
    const nonce = new Date().getTime().toString();
    const outputDir = path.join(this.vvppEngineDir, ".tmp", nonce);

    const streams: fs.ReadStream[] = [];
    // 名前.数値.vvppの場合は分割されているとみなして連結する
    if (vvppPath.match(/\.[0-9]+\.vvpp$/)) {
      log.log("vvpp is split, finding other parts...");
      const vvppPathGlob = vvppPath
        .replace(/\.[0-9]+\.vvpp$/, ".*.vvpp")
        .replace(/\\/g, "/"); // node-globはバックスラッシュを使えないので、スラッシュに置換する
      const filePaths: string[] = [];
      for (const p of await globAsync(vvppPathGlob)) {
        if (!p.match(/\.[0-9]+\.vvpp$/)) {
          continue;
        }
        log.log(`found ${p}`);
        filePaths.push(p);
      }
      filePaths.sort((a, b) => {
        const aMatch = a.match(/\.([0-9]+)\.vvpp$/);
        const bMatch = b.match(/\.([0-9]+)\.vvpp$/);
        if (aMatch === null || bMatch === null) {
          throw new Error(`match is null: a=${a}, b=${b}`);
        }
        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
      });
      for (const p of filePaths) {
        streams.push(fs.createReadStream(p));
      }
    } else {
      log.log("Not a split file");
      streams.push(fs.createReadStream(vvppPath));
    }

    log.log("Extracting vvpp to", outputDir);
    await new Promise((resolve, reject) => {
      new MultiStream(streams)
        .pipe(Extract({ path: outputDir }))
        .on("close", resolve)
        .on("error", reject);
    });
    // FIXME: バリデーションをかけるか、`validateEngineDir`で検査する
    const manifest = JSON.parse(
      await fs.promises.readFile(
        path.join(outputDir, "engine_manifest.json"),
        "utf-8"
      )
    ) as MinimumEngineManifest;
    return {
      outputDir,
      manifest,
    };
  }

  async install(vvppPath: string) {
    const { outputDir, manifest } = await this.extractVvpp(vvppPath);
    const dirName = this.toValidDirName(manifest);
    const engineDirectory = path.join(this.vvppEngineDir, dirName);
    const oldEngineDirName = (
      await fs.promises.readdir(this.vvppEngineDir)
    ).find((dir) => {
      return this.isEngineDirName(dir, manifest);
    });
    if (oldEngineDirName) {
      this.markWillMove(outputDir, dirName);
    } else {
      await moveFile(outputDir, engineDirectory);
    }
    if (isNotWin) {
      await fs.promises.chmod(
        path.join(engineDirectory, manifest.command),
        "755"
      );
    }
  }

  async handleMarkedEngineDirs() {
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
          } catch (e) {
            if (i === 4) {
              log.error(e);
              dialog.showErrorBox(
                "エンジン削除エラー",
                `エンジンの削除に失敗しました。エンジンのフォルダを手動で削除してください。\n${deletingEngineDir}\nエラー内容: ${e}`
              );
            } else {
              log.error(`Failed to rename engine directory: ${e}, retrying`);
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        }
      })
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
                `エンジンの追加に失敗しました。エンジンのフォルダを手動で移動してください。\n${from}\nエラー内容: ${e}`
              );
            } else {
              log.error(`Failed to rename engine directory: ${e}, retrying`);
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        }
      })
    );
    this.willReplaceEngineDirs = [];
  }
}

export default VvppManager;
