import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import log from "electron-log";
import AsyncLock from "async-lock";
import EngineManager from "./engineManager";
import { EngineId, LibraryId, LibraryInstallStatus } from "@/type/preload";
import { Configuration, DefaultApi } from "@/openapi";

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

  async startLibraryDownloadAndInstall(
    engineId: EngineId,
    libraryId: LibraryId,
    libraryName: string,
    libraryDownloadUrl: string,
    onUpdate: (status: LibraryInstallStatus) => void
  ): Promise<Buffer | undefined> {
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
      onUpdate({
        status: "error",
        message: `ダウンロード先のサーバーが${downloadRes.status}エラーを返しました`,
      });
      return;
    } else if (downloadRes.body === null) {
      log.error(prefix + `Failed to download library: No body`);
      onUpdate({
        status: "error",
        message: `ダウンロード先のサーバーがライブラリを返しませんでした`,
      });
      return;
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
      log.log(prefix + "Download complete");

      if (this.engineApis[engineId] === undefined) {
        this.engineApis[engineId] = new DefaultApi(
          new Configuration({ basePath: engine.host })
        );
      }
      const libraryBuffer = await fs.promises.readFile(tempFilePath);

      onUpdate({
        status: "installing",
      });
      log.log(prefix + "Waiting for lock");

      await this.lock.acquire(`${engineId}`, async () => {
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
      await fs.promises.rm(tempFilePath);
      onUpdate({
        status: "done",
      });
    } catch (e) {
      log.error(prefix + "Failed to install library");
      log.error(e);
      onUpdate({
        status: "error",
        message: `ライブラリのインストールに失敗しました。エラー内容：${e}`,
      });
    } finally {
      tempFile.close();
      log.log(prefix + "Removing temp file");
      await fs.promises.rm(tempFilePath);
    }
  }

  async uninstallLibrary(
    engineId: EngineId,
    libraryId: LibraryId,
    libraryName: string,
    onUpdate: (status: LibraryInstallStatus) => void
  ) {
    const engine = this.engineManager.fetchEngineInfo(engineId);
    const prefix = `LIBRARY UNINSTALL ${libraryName}: `;
    log.log(prefix + `Started ${libraryName}, Engine: ${engine.name}`);

    onUpdate({
      status: "uninstalling",
    });
    log.log(prefix + "Waiting for lock");

    try {
      await this.lock.acquire(`${engineId}`, async () => {
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
    } catch (e) {
      log.error(prefix + "Failed to uninstall library");
      log.error(e);
      onUpdate({
        status: "error",
        message: `ライブラリのアンインストールに失敗しました。エラー内容：${e}`,
      });
    }
  }
}

export default LibraryManager;
