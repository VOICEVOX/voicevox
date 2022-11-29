import { EngineManifest } from "@/openapi";
import fs from "fs";
import path from "path";
import yauzl from "yauzl";
import log from "electron-log";
import { moveFile } from "move-file";
import { dialog } from "electron";

export class VvppManager {
  baseDir: string;

  // # エンジン削除・エンジン上書き時の処理について
  //
  // 削除：
  // * アプリ終了時にVVPPディレクトリを消去するように予約
  // * アプリ終了時、予約されていた処理を行う
  // 上書き：
  // * VVPPをインストール先にtmpとして展開、失敗したら停止
  // * アプリ終了時に古いVVPPディレクトリを消去するように予約
  // * アプリ終了時に新しいVVPPディレクトリをリネームするように予約
  // * アプリ終了時、予約されていた処理を行う
  //
  // エンジンを停止してからではないとディレクトリを削除できないため、このような実装になっている。
  willDeleteEngines: Set<string>;
  willRenameEngines: Array<{ from: string; to: string }>;

  constructor({ baseDir }: { baseDir: string }) {
    this.baseDir = baseDir;
    this.willDeleteEngines = new Set();
    this.willRenameEngines = [];
  }

  getEngineDirPaths(): { userEngineDir: string; vvppEngineDir: string } {
    return {
      userEngineDir: path.join(this.baseDir, "engines"),
      vvppEngineDir: path.join(this.baseDir, "vvpp-engines"),
    };
  }

  markWillMove(from: string, to: string) {
    this.willRenameEngines.push({ from, to });
  }

  markWillDelete(engineId: string) {
    this.willDeleteEngines.add(engineId);
  }

  toValidDirName(manifest: EngineManifest) {
    // フォルダに使用できない文字が含まれている場合は置換する
    return `${manifest.name.replace(/[\s<>:"/\\|?*]+/g, "_")}+${manifest.uuid}`;
  }

  isEngineDirName(dir: string, manifest: EngineManifest) {
    return dir.endsWith(`+${manifest.uuid}`);
  }

  async extractVvpp(
    vvppPath: string
  ): Promise<{ outputDir: string; manifest: EngineManifest }> {
    const zipFile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
      yauzl.open(vvppPath, { lazyEntries: true }, (error, zipFile) => {
        if (error != null) {
          reject(error);
          return;
        }
        resolve(zipFile);
      });
    });
    const nonce = new Date().getTime().toString();
    const outputDir = path.join(this.baseDir, "temp-engines", nonce);
    await fs.promises.mkdir(outputDir, { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const promises: Promise<void>[] = [];
      zipFile.on("entry", async (entry: yauzl.Entry) => {
        zipFile.openReadStream(entry, (error, readStream) => {
          if (error != null) {
            reject(error);
            return;
          }
          if (entry.fileName.endsWith("/")) {
            fs.mkdirSync(path.join(outputDir, entry.fileName));
            zipFile.readEntry();
            return;
          }
          promises.push(
            new Promise<void>((resolve2) => {
              readStream.on("end", () => {
                zipFile.readEntry();
                resolve2();
              });
              readStream.pipe(
                fs.createWriteStream(path.join(outputDir, entry.fileName))
              );
            })
          );
        });
      });
      promises.push(
        new Promise<void>((resolve2) => {
          zipFile.on("end", () => {
            resolve2();
          });
        })
      );
      zipFile.readEntry();
      Promise.all(promises).then(() => {
        resolve();
      });
    });
    // FIXME: バリデーションをかける
    const manifest = JSON.parse(
      await fs.promises.readFile(
        path.join(outputDir, "engine_manifest.json"),
        "utf-8"
      )
    ) as EngineManifest;
    return {
      outputDir,
      manifest,
    };
  }

  async processDeferredProcesses() {
    const { vvppEngineDir } = this.getEngineDirPaths();
    await Promise.all(
      [...this.willDeleteEngines].map(async (engineId) => {
        let deletingEngineDir: string | undefined = undefined;
        for (const engineDir of await fs.promises.readdir(vvppEngineDir)) {
          if (engineDir.endsWith("+" + engineId)) {
            deletingEngineDir = path.join(vvppEngineDir, engineDir);
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
    this.willDeleteEngines.clear();
    await Promise.all(
      [...this.willRenameEngines].map(async ({ from, to }) => {
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
    this.willRenameEngines = [];
  }
}

export default VvppManager;
