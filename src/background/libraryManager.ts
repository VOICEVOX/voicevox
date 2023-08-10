import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import log from "electron-log";
import AsyncLock from "async-lock";
import EngineManager from "./engineManager";
import { EngineId, LibraryId, LibraryInstallStatus } from "@/type/preload";
import { Configuration, DefaultApi, DownloadableLibrary } from "@/openapi";

export class LibraryManager {
  engineManager: EngineManager;
  tempDir: string;
  lock: AsyncLock = new AsyncLock();
  engineApis: Record<EngineId, DefaultApi> = {};

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

  async startLibraryDownload(
    engineId: EngineId,
    library: DownloadableLibrary,
    onUpdate: (status: LibraryInstallStatus) => void
  ): Promise<Buffer | undefined> {
    const engine = this.engineManager.fetchEngineInfo(engineId);
    const libraryUuid = LibraryId(library.uuid);
    const prefix = `LIBRARY INSTALL ${library.name}: `;
    log.log(
      prefix +
        `Started ${library.name}, Engine: ${engine.name}, URL: ${library.downloadUrl}`
    );
    const downloadRes = await fetch(library.downloadUrl);
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
      `vv-temp-${engineId}-${library.uuid}`
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
            libraryUuid,
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
      tempFile.close();
      log.log(prefix + "Removing temp file");
      await fs.promises.rm(tempFilePath);
    }
  }
}

export default LibraryManager;
