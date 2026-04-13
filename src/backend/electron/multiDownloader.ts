import fs from "node:fs";
import path from "node:path";
import { createLogger } from "@/helpers/log";
import type { ProgressCallback } from "@/helpers/progressHelper";

const log = createLogger("multiDownloader");

export type RemoteFileInfo = {
  url: string;
  size: number;
  name: string;
};

/**
 * 複数のファイルを並列にダウンロードするクラス。
 * ダウンロードしたファイルは、[Symbol.asyncDispose]で削除される。
 *
 * ファイルは`${downloadDir}/${name}`に保存される。
 */
export class MultiDownloader {
  private internalDownloadedPaths: string[] = [];
  public readonly totalBytes: number;

  constructor(
    public downloadDir: string,
    public remoteFiles: RemoteFileInfo[],
    private callbacks?: { onProgress: ProgressCallback<"download"> },
  ) {
    // ダウンロード進捗の初期化
    callbacks?.onProgress?.({ type: "download", progress: 0 });

    let totalBytes = 0;
    for (const file of remoteFiles) {
      totalBytes += file.size;
    }

    this.totalBytes = totalBytes;
  }

  async download() {
    let downloadedBytes = 0;
    const abort = new AbortController();
    await Promise.all(
      this.remoteFiles.map(async (p, i) => {
        try {
          const { url, name } = p;
          log.info(`Download ${name} from ${url}`);

          const res = await fetch(url, { signal: abort.signal });
          if (!res.ok || res.body == null)
            throw new Error(`Failed to download ${name} from ${url}`);
          const downloadPath = path.join(this.downloadDir, name);
          this.internalDownloadedPaths[i] = downloadPath;
          const fileStream = fs.createWriteStream(downloadPath);

          // ファイルに書き込む
          await res.body.pipeTo(
            new WritableStream({
              write: (chunk) => {
                fileStream.write(chunk as Buffer);
                downloadedBytes += chunk.length;
                this.callbacks?.onProgress?.({
                  type: "download",
                  progress: (downloadedBytes / this.totalBytes) * 100,
                });
              },
            }),
          );

          // ファイルを確実に閉じる
          const { promise, resolve, reject } = Promise.withResolvers<void>();
          fileStream.on("close", resolve);
          fileStream.on("error", reject);
          fileStream.close();
          await promise;

          log.info(`Downloaded ${name} to ${downloadPath}`);

          // TODO: ハッシュチェック
        } catch (error) {
          abort.abort();
          throw error;
        }
      }),
    );
  }

  get downloadedPaths() {
    return this.internalDownloadedPaths.filter((p) => p != undefined);
  }

  async [Symbol.asyncDispose]() {
    // ダウンロードしたファイルを削除
    await Promise.all(
      this.downloadedPaths.map(async (path) => {
        log.info(`Delete downloaded file: ${path}`);
        await fs.promises.unlink(path);
      }),
    );
  }
}
