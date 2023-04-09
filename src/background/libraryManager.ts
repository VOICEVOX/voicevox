import fs from "fs";
import path from "path";
import AsyncLock from "async-lock";
import fetch from "node-fetch";
import log from "electron-log";
import EngineManager from "./engineManager";
import {
  EngineId,
  LibraryInstallId,
  LibraryInstallStatus,
} from "@/type/preload";
import { DownloadableLibrary } from "@/openapi";

export class LibraryManager {
  engineManager: EngineManager;
  tempDir: string;
  lock: AsyncLock;

  constructor({
    engineManager,
    tempDir,
  }: {
    engineManager: EngineManager;
    tempDir: string;
  }) {
    this.engineManager = engineManager;
    this.tempDir = tempDir;
    this.lock = new AsyncLock();
  }

  async installLibrary(
    engineId: EngineId,
    library: DownloadableLibrary,
    libraryInstallId: LibraryInstallId,
    onUpdate: (status: LibraryInstallStatus) => void
  ): Promise<void> {
    const engine = this.engineManager.fetchEngineInfo(engineId);
    const prefix = `LIBRARY INSTALL ${libraryInstallId}: `;
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
    const tempFilePath = path.join(this.tempDir, `vv-temp-${libraryInstallId}`);
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

      // OpenAPIのクライアントでは、ファイルをアップロードするためのAPIがないので、
      // node-fetchを使って直接アップロードする
      const url =
        engine.host.replace(/\/$/, "") + `/install_library/${library.uuid}`;
      const bodyStream = fs.createReadStream(tempFilePath);

      onUpdate({
        status: "installing",
      });

      log.log(prefix + "Waiting for lock");
      await this.lock.acquire(`${engineId}`, async () => {
        log.log(prefix + "Installing library");
        const installRes = await fetch(url, {
          method: "POST",

          body: bodyStream,
        });
        if (!installRes.ok) {
          log.error(
            prefix +
              `Failed to install library: Server returned ${installRes.status}`
          );
          onUpdate({
            status: "error",
            message: `ライブラリのインストールに失敗しました。エラーコード：${installRes.status}`,
          });
          return;
        }
        log.log(prefix + "Library installed");
      });
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
}

export default LibraryManager;
