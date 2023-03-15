import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { promisify } from "util";
import log from "electron-log";
import { moveFile } from "move-file";
// FIXME: 正式版が出たら切り替える。https://github.com/VOICEVOX/voicevox_project/issues/2#issuecomment-1401721286
import { Extract } from "unzipper";
import { app, dialog } from "electron";
import MultiStream from "multistream";
import glob, { glob as callbackGlob } from "glob";
import which from "which";
import {
  EngineId,
  EngineInfo,
  minimumEngineManifestSchema,
  MinimumEngineManifest,
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

// # 軽い概要
//
// フォルダ名："エンジン名+UUID"
// エンジン名にフォルダ名に使用できない文字が含まれている場合は"_"に置換する。連続する"_"は1つにする。
// 拡張子は".vvpp"または".vvppp"。".vvppp"は分割されているファイルであることを示す。
// engine.0.vvppp、engine.1.vvppp、engine.2.vvppp、...というように分割されている。
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

  willDeleteEngineIds: Set<EngineId>;
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

  markWillDelete(engineId: EngineId) {
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

  async extractVvpp(
    vvppLikeFilePath: string
  ): Promise<{ outputDir: string; manifest: MinimumEngineManifest }> {
    const nonce = new Date().getTime().toString();
    const outputDir = path.join(this.vvppEngineDir, ".tmp", nonce);

    let files: string[];
    let format;
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
        if (aMatch === null || bMatch === null) {
          throw new Error(`match is null: a=${a}, b=${b}`);
        }
        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
      });
      format = await this.detectFileFormat(filePaths[0]);
      if (!format) {
        throw new Error(`Unknown file format: ${filePaths[0]}`);
      }
      files = filePaths;
    } else {
      log.log("Not a split file");
      format = await this.detectFileFormat(vvppLikeFilePath);
      if (!format) {
        throw new Error(`Unknown file format: ${vvppLikeFilePath}`);
      }
      files = [vvppLikeFilePath];
    }

    log.log("Format:", format);
    log.log("Extracting vvpp to", outputDir);
    try {
      switch (format) {
        case "zip": {
          await new Promise((resolve, reject) => {
            const streams = [];
            try {
              for (const file of files) {
                streams.push(fs.createReadStream(file));
              }

              new MultiStream(streams)
                .pipe(Extract({ path: outputDir }))
                .on("close", resolve)
                .on("error", reject);
            } finally {
              streams.forEach((s) => s.close());
            }
          });
          break;
        }
        case "7z": {
          let sevenZipPath = "7z";
          if (import.meta.env.DEV) {
            if (process.platform === "win32") {
              // Windows: build/7za.exe
              sevenZipPath = path.resolve(__dirname, "..", "build", "7zr.exe");
            } else {
              // Mac/Linux: PATH上に7zがあると想定、なければエラーにする
              await promisify(which)("7z");
            }
          } else {
            // ビルド時に7zをexeと同じディレクトリにバンドルする
            sevenZipPath = path.join(
              app.getPath("exe"),
              process.platform === "win32" ? "7zr.exe" : "7z"
            );
          }

          let tmpFile: string | undefined;
          let file: string;
          try {
            if (files.length > 1) {
              log.log(`Concatenating ${files.length} files...`);
              tmpFile = path.join(
                app.getPath("temp"),
                `vvpp-${new Date().getTime()}.7z`
              );
              log.log("Temporary file:", tmpFile);
              file = tmpFile;
              await new Promise<void>((resolve, reject) => {
                if (!tmpFile) throw new Error("tmpFile is undefined");
                const inputStreams = files.map((f) => fs.createReadStream(f));
                const outputStream = fs.createWriteStream(tmpFile);
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
              file = files[0];
              log.log("Single file, not concatenating");
            }

            await new Promise<void>((resolve, reject) => {
              const args = ["x", "-o" + outputDir, file, "-t7z"];

              log.log(
                "Spawning 7z:",
                sevenZipPath,
                args.map((a) => JSON.stringify(a)).join(" ")
              );
              const child = spawn(sevenZipPath, args, {
                stdio: ["pipe", "inherit", "inherit"],
              });

              child.on("exit", (code) => {
                if (code === 0) {
                  resolve();
                } else {
                  reject(new Error(`7z exited with code ${code}`));
                }
              });
              child.on("error", reject);
            });
          } finally {
            if (tmpFile) {
              log.log("Removing temporary file", tmpFile);
              await fs.promises.rm(tmpFile);
            }
          }
          break;
        }
        default: {
          throw new Error("Unreachable!");
        }
      }
      const manifest: MinimumEngineManifest = minimumEngineManifestSchema.parse(
        JSON.parse(
          await fs.promises.readFile(
            path.join(outputDir, "engine_manifest.json"),
            "utf-8"
          )
        )
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
            break;
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

  private async detectFileFormat(
    filePath: string
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
