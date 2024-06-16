import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import log from "electron-log/main";
import { moveFile } from "move-file";
import { app, dialog } from "electron";
import MultiStream from "multistream";
import glob, { glob as callbackGlob } from "glob";
import AsyncLock from "async-lock";
import {
  EngineId,
  EngineInfo,
  minimumEngineManifestSchema,
  MinimumEngineManifestType,
} from "@/type/preload";

const isNotWin = process.platform !== "win32";

// https://www.garykessler.net/library/file_sigs.html#:~:text=7-zip%20compressed%20file
const SEVEN_ZIP_MAGIC_NUMBER = Buffer.from([
  0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c,
]);

const ZIP_MAGIC_NUMBER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

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
  vvppEngineDir: string;

  willDeleteEngineIds: Set<EngineId>;
  willReplaceEngineDirs: Array<{ from: string; to: string }>;

  private lock = new AsyncLock();

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

  markWillDelete(engineId: EngineId) {
    this.willDeleteEngineIds.add(engineId);
  }

  toValidDirName(manifest: MinimumEngineManifestType) {
    // フォルダに使用できない文字が含まれている場合は置換する
    return `${manifest.name.replace(/[\s<>:"/\\|?*]+/g, "_")}+${manifest.uuid}`;
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

  private async extractVvpp(
    vvppLikeFilePath: string,
  ): Promise<{ outputDir: string; manifest: MinimumEngineManifestType }> {
    const nonce = new Date().getTime().toString();
    const outputDir = path.join(this.vvppEngineDir, ".tmp", nonce);

    let archiveFileParts: string[];
    // 名前.数値.vvpppの場合は分割されているとみなして連結する
    if (vvppLikeFilePath.match(/\.[0-9]+\.vvppp$/)) {
      log.log("vvpp is split, finding other parts...");
      const vvpppPathGlob = vvppLikeFilePath
        .replace(/\.[0-9]+\.vvppp$/, ".*.vvppp")
        .replace(/\\/g, "/"); // node-globはバックスラッシュを使えないので、スラッシュに置換する
      const filePaths: string[] = [];
      for (const p of await globAsync(vvpppPathGlob)) {
        if (!p.match(/\.[0-9]+\.vvppp$/)) {
          continue;
        }
        log.log(`found ${p}`);
        filePaths.push(p);
      }
      filePaths.sort((a, b) => {
        const aMatch = a.match(/\.([0-9]+)\.vvppp$/);
        const bMatch = b.match(/\.([0-9]+)\.vvppp$/);
        if (aMatch == null || bMatch == null) {
          throw new Error(`match is null: a=${a}, b=${b}`);
        }
        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
      });
      archiveFileParts = filePaths;
    } else {
      log.log("Not a split file");
      archiveFileParts = [vvppLikeFilePath];
    }

    const format = await this.detectFileFormat(archiveFileParts[0]);
    if (!format) {
      throw new Error(`Unknown file format: ${archiveFileParts[0]}`);
    }
    log.log("Format:", format);
    log.log("Extracting vvpp to", outputDir);
    try {
      let tmpConcatenatedFile: string | undefined;
      let archiveFile: string;
      try {
        if (archiveFileParts.length > 1) {
          // -siオプションでの7z解凍はサポートされていないため、
          // ファイルを連結した一次ファイルを作成し、それを7zで解凍する。
          log.log(`Concatenating ${archiveFileParts.length} files...`);
          tmpConcatenatedFile = path.join(
            app.getPath("temp"),
            `vvpp-${new Date().getTime()}.${format}`,
          );
          log.log("Temporary file:", tmpConcatenatedFile);
          archiveFile = tmpConcatenatedFile;
          await new Promise<void>((resolve, reject) => {
            if (!tmpConcatenatedFile) throw new Error("tmpFile is undefined");
            const inputStreams = archiveFileParts.map((f) =>
              fs.createReadStream(f),
            );
            const outputStream = fs.createWriteStream(tmpConcatenatedFile);
            new MultiStream(inputStreams)
              .pipe(outputStream)
              .on("close", () => {
                outputStream.close();
                resolve();
              })
              .on("error", reject);
          });
          log.log("Concatenated");
        } else {
          archiveFile = archiveFileParts[0];
          log.log("Single file, not concatenating");
        }

        const args = ["x", "-o" + outputDir, archiveFile, "-t" + format];

        let sevenZipPath = import.meta.env.VITE_7Z_BIN_NAME;
        if (!sevenZipPath) {
          throw new Error("7z path is not defined");
        }
        if (import.meta.env.PROD) {
          sevenZipPath = path.join(
            path.dirname(app.getPath("exe")),
            sevenZipPath,
          );
        }
        log.log(
          "Spawning 7z:",
          sevenZipPath,
          args.map((a) => JSON.stringify(a)).join(" "),
        );
        await new Promise<void>((resolve, reject) => {
          const child = spawn(sevenZipPath, args, {
            stdio: ["pipe", "pipe", "pipe"],
          });

          child.stdout?.on("data", (data) => {
            log.info(`7z STDOUT: ${data.toString("utf-8")}`);
          });

          child.stderr?.on("data", (data) => {
            log.error(`7z STDERR: ${data.toString("utf-8")}`);
          });

          child.on("exit", (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`7z exited with code ${code}`));
            }
          });
          // FIXME: rejectが2回呼ばれることがある
          child.on("error", reject);
        });
      } finally {
        if (tmpConcatenatedFile) {
          log.log("Removing temporary file", tmpConcatenatedFile);
          await fs.promises.rm(tmpConcatenatedFile);
        }
      }
      const manifest: MinimumEngineManifestType =
        minimumEngineManifestSchema.parse(
          JSON.parse(
            await fs.promises.readFile(
              path.join(outputDir, "engine_manifest.json"),
              "utf-8",
            ),
          ),
        );
      return {
        outputDir,
        manifest,
      };
    } catch (e) {
      if (fs.existsSync(outputDir)) {
        log.log("Failed to extract vvpp, removing", outputDir);
        await fs.promises.rm(outputDir, { recursive: true });
      }
      throw e;
    }
  }

  /**
   * 追加
   */
  async install(vvppPath: string) {
    await this.lock.acquire(lockKey, () => this._install(vvppPath));
  }
  private async _install(vvppPath: string) {
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
        "755",
      );
    }
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
                `エンジンの削除に失敗しました。エンジンのフォルダを手動で削除してください。\n${deletingEngineDir}\nエラー内容: ${e}`,
              );
            } else {
              log.error(`Failed to rename engine directory: ${e}, retrying`);
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
                `エンジンの追加に失敗しました。エンジンのフォルダを手動で移動してください。\n${from}\nエラー内容: ${e}`,
              );
            } else {
              log.error(`Failed to rename engine directory: ${e}, retrying`);
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

  private async detectFileFormat(
    filePath: string,
  ): Promise<"zip" | "7z" | undefined> {
    const file = await fs.promises.open(filePath, "r");

    const buffer = Buffer.alloc(8);
    await file.read(buffer, 0, 8, 0);
    await file.close();

    if (buffer.compare(SEVEN_ZIP_MAGIC_NUMBER, 0, 6, 0, 6) === 0) {
      return "7z";
    } else if (buffer.compare(ZIP_MAGIC_NUMBER, 0, 4, 0, 4) === 0) {
      return "zip";
    }
    return undefined;
  }
}

export default VvppManager;
