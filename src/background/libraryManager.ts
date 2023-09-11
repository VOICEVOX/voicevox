import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import log from "electron-log";
import AsyncLock from "async-lock";
import EngineManager from "./engineManager";
import { EngineId, LibraryId, LibraryInstallStatus } from "@/type/preload";
import { Configuration, DefaultApi, ResponseError } from "@/openapi";
import { Result, failure, success } from "@/type/result";

/**
 * 音声ライブラリのダウンロードとインストール、アンインストールを行う
 * インストール状況などの状態は持たない
 */
export class LibraryManager {
  engineManager: EngineManager;
  tempDir: string;
  lock: AsyncLock = new AsyncLock();
  engineApis: Record<EngineId, DefaultApi> = {}; // ライブラリ管理のためだけに使う

  constructor({
    engineManager,
    tempDir,
  }: {
    engineManager: EngineManager;
    tempDir: string;
  }) {
    this.engineManager = engineManager;
    this.tempDir = tempDir;
  }

  private setEngineApi(engineId: EngineId, engineHost: string): void {
    if (this.engineApis[engineId] === undefined) {
      this.engineApis[engineId] = new DefaultApi(
        new Configuration({ basePath: engineHost })
      );
    }
  }

  private async lockByEngineId(engineId: EngineId, fn: () => Promise<void>) {
    await this.lock.acquire(`${engineId}`, fn);
  }

  /**
   * 成功時・失敗時ともにステータス情報をonUpdateで通知して正常終了
   */
  async startLibraryDownloadAndInstall(
    engineId: EngineId,
    libraryId: LibraryId,
    libraryName: string,
    libraryDownloadUrl: string,
    onUpdate: (status: LibraryInstallStatus) => void
  ): Promise<Result<undefined>> {
    const engine = this.engineManager.fetchEngineInfo(engineId);
    const prefix = `LIBRARY INSTALL ${libraryName}: `;
    log.log(
      prefix +
        `Started ${libraryName}, Engine: ${engine.name}, URL: ${libraryDownloadUrl}`
    );
    const downloadRes = await fetch(libraryDownloadUrl);
    if (!downloadRes.ok) {
      log.error(
        prefix +
          `Failed to download library: Server returned ${downloadRes.status}`
      );
      let reason: string;
      if (downloadRes.status >= 400 && downloadRes.status < 500) {
        switch (downloadRes.status) {
          case 401:
          case 403:
            reason = "ダウンロードが拒否された";
            break;
          case 404:
            reason = "ダウンロードするライブラリが見つからない";
            break;
          default:
            reason = "アクセスに失敗した";
            break;
        }
      } else if (downloadRes.status >= 500) {
        switch (downloadRes.status) {
          case 502:
          case 503:
            reason = "サーバーがダウンしている";
            break;
          case 504:
            reason = "サーバーが時間内に応答しなかった";
            break;
          default:
            reason = "サーバーでエラーが発生した";
            break;
        }
      } else {
        reason = "ダウンロード先のサーバーが不明なエラーを返した";
      }
      onUpdate({
        status: "error",
        message: `${reason}ため、現在このライブラリをダウンロードできません。（ステータスコード：${downloadRes.status}）`,
      });
      return failure(
        "download",
        new Error(`status code: ${downloadRes.status}`)
      );
    } else if (downloadRes.body === null) {
      log.error(prefix + `Failed to download library: No body`);
      onUpdate({
        status: "error",
        message: `ダウンロード先のサーバーがライブラリを返しませんでした`,
      });
      return failure("download", new Error("library not returned from server"));
    }
    const tempFilePath = path.join(
      this.tempDir,
      `vv-temp-${engineId}-${libraryId}`
    );
    log.log(prefix + `Writing to ${tempFilePath}`);

    const total = Number(downloadRes.headers.get("content-length"));
    let downloaded = 0;
    onUpdate({
      status: "downloading",
      contentLength: total,
      downloaded,
    });
    const tempFile = fs.createWriteStream(tempFilePath);
    let tempFileClosed = false;

    let result: Result<undefined>;
    try {
      const progressInterval = 1024 * 1024;
      let lastProgress = 0;
      downloadRes.body.on("data", (chunk) => {
        downloaded += chunk.length;
        tempFile.write(chunk);
        if (
          Math.floor(downloaded) - Math.floor(lastProgress) >=
          progressInterval
        ) {
          onUpdate({
            status: "downloading",
            contentLength: total,
            downloaded,
          });
          if (total) {
            log.log(
              prefix +
                `Downloaded ${downloaded}/${total} bytes (${(
                  (downloaded / total) *
                  100
                ).toFixed(1)}%)`
            );
          } else {
            log.log(
              prefix +
                `Downloaded ${downloaded} bytes (content-length header is not set)`
            );
          }
          lastProgress = downloaded;
        }
      });
      await new Promise((resolve) => {
        if (!downloadRes.body) throw new Error("res.body is null");
        downloadRes.body.on("end", resolve);
      });
      tempFile.close();
      tempFileClosed = true;
      log.log(prefix + "Download complete");

      this.setEngineApi(engineId, engine.host);
      const libraryBuffer = await fs.promises.readFile(tempFilePath);

      onUpdate({
        status: "installing",
      });
      log.log(prefix + "Waiting for lock");

      await this.lockByEngineId(engineId, async () => {
        log.log(prefix + "Installing library");
        await this.engineApis[
          engineId
        ].installLibraryInstallLibraryLibraryUuidPost(
          {
            libraryUuid: libraryId,
          },
          {
            body: libraryBuffer,
          }
        );
        log.log(prefix + "Library installed");
      });
      if (fs.existsSync(tempFilePath)) {
        await fs.promises.rm(tempFilePath);
      }
      onUpdate({
        status: "done",
      });
      result = success(undefined);
    } catch (e) {
      log.error(prefix + "Failed to install library");
      let errorMessage: unknown;
      if (e instanceof ResponseError && e.response.statusText) {
        errorMessage = e.response.statusText;
      } else {
        errorMessage = e;
      }
      log.error(errorMessage);
      onUpdate({
        status: "error",
        message: `ライブラリのインストールに失敗しました。エラー内容：${errorMessage}`,
      });
      result = failure("install", new Error("failed to install library"));
    } finally {
      if (!tempFileClosed) {
        tempFile.close();
      }
      if (fs.existsSync(tempFilePath)) {
        log.log(prefix + "Removing temp file");
        await fs.promises.rm(tempFilePath);
      }
    }
    return result;
  }

  /**
   * 成功時・失敗時ともにステータス情報をonUpdateで通知して正常終了
   */
  async uninstallLibrary(
    engineId: EngineId,
    libraryId: LibraryId,
    libraryName: string,
    onUpdate: (status: LibraryInstallStatus) => void
  ): Promise<Result<undefined>> {
    const engine = this.engineManager.fetchEngineInfo(engineId);
    const prefix = `LIBRARY UNINSTALL ${libraryName}: `;
    log.log(prefix + `Started ${libraryName}, Engine: ${engine.name}`);

    onUpdate({
      status: "uninstalling",
    });
    log.log(prefix + "Waiting for lock");

    this.setEngineApi(engineId, engine.host);

    try {
      await this.lockByEngineId(engineId, async () => {
        log.log(prefix + "Uninstalling library");
        await this.engineApis[
          engineId
        ].uninstallLibraryUninstallLibraryLibraryUuidPost({
          libraryUuid: libraryId,
        });
        log.log(prefix + "Library uninstalled");
      });
      onUpdate({
        status: "done",
      });
      return success(undefined);
    } catch (e) {
      log.error(prefix + "Failed to uninstall library");
      let errorMessage: unknown;
      if (e instanceof ResponseError && e.response.statusText) {
        errorMessage = e.response.statusText;
      } else {
        errorMessage = e;
      }
      log.error(errorMessage);
      onUpdate({
        status: "error",
        message: `ライブラリのアンインストールに失敗しました。エラー内容：${errorMessage}`,
      });
      return failure("uninstall", new Error("failed to uninstall library"));
    }
  }
}

export default LibraryManager;
