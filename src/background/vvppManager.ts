import { EngineManifest } from "@/openapi";
import fs from "fs";
import path from "path";
import yauzl from "yauzl";
import log from "electron-log";
import { moveFile } from "move-file";
import { dialog } from "electron";

export class VvppManager {
  vvppEngineDir: string;

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
    const outputDir = path.join(this.vvppEngineDir, ".tmp", nonce);
    await fs.promises.mkdir(outputDir, { recursive: true });
    log.log("Extracting vvpp to", outputDir);
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

  async load(vvppPath: string) {
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
  }

  async handleEngineDirs() {
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
