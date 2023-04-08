import fs from "fs";
import path from "path";
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

  async installLibrary(
    engineId: EngineId,
    library: DownloadableLibrary,
    libraryInstallId: LibraryInstallId,
    onUpdate: (status: LibraryInstallStatus) => void
  ): Promise<void> {
    log.log(`Installing library: ${library.name}, URL: ${library.downloadUrl}`);
    const res = await fetch(library.downloadUrl);
    if (!res.ok) {
      log.error(`Failed to download library: Server returned ${res.status}`);
      onUpdate({
        status: "error",
        message: `ダウンロード先のサーバーが${res.status}エラーを返しました`,
      });
      return;
    } else if (res.body === null) {
      log.error(`Failed to download library: No body`);
      onUpdate({
        status: "error",
        message: `ダウンロード先のサーバーがライブラリを返しませんでした`,
      });
      return;
    }
    const tempFilePath = path.join(this.tempDir, `vv-temp-${libraryInstallId}`);
    log.log(`Writing to ${tempFilePath}`);

    const total = Number(res.headers.get("content-length"));
    let downloaded = 0;
    onUpdate({
      status: "downloading",
      contentLength: total,
      downloaded,
    });
    const tempFile = await fs.promises.open(tempFilePath, "w");
    res.body.on("data", (chunk) => {
      downloaded += chunk.length;
      onUpdate({
        status: "downloading",
        contentLength: total,
        downloaded,
      });
      tempFile.write(chunk);
      log.log(
        `Downloaded ${downloaded}/${total} (${(downloaded / total) * 100}%)`
      );
    });
    await new Promise((resolve) => {
      if (!res.body) throw new Error("res.body is null");
      res.body.on("end", resolve);
    });
    await tempFile.close();
    log.log("Download complete");

    // 仮なので削除
    await fs.promises.rm(tempFilePath);
  }
}

export default LibraryManager;
