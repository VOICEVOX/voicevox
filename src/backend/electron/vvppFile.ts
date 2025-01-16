/**
 * VVPPファイルを扱うモジュール。
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import MultiStream from "multistream";
import { glob } from "glob";
import log from "electron-log/main";
import { app } from "electron";
import {
  minimumEngineManifestSchema,
  MinimumEngineManifestType,
} from "@/type/preload";
import { ProgressCallback } from "@/helpers/progressHelper";

// https://www.garykessler.net/library/file_sigs.html#:~:text=7-zip%20compressed%20file
const SEVEN_ZIP_MAGIC_NUMBER = Buffer.from([
  0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c,
]);

const ZIP_MAGIC_NUMBER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** VVPPファイルが分割されている場合、それらのファイルを取得する */
async function getArchiveFileParts(
  vvppLikeFilePath: string,
): Promise<string[]> {
  let archiveFileParts: string[];
  // 名前.数値.vvpppの場合は分割されているとみなして連結する
  if (vvppLikeFilePath.match(/\.[0-9]+\.vvppp$/)) {
    log.log("vvpp is split, finding other parts...");
    const vvpppPathGlob = vvppLikeFilePath
      .replace(/\.[0-9]+\.vvppp$/, ".*.vvppp")
      .replace(/\\/g, "/"); // node-globはバックスラッシュを使えないので、スラッシュに置換する
    const filePaths: string[] = [];
    for (const p of await glob(vvpppPathGlob)) {
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
  return archiveFileParts;
}

/** 分割されているVVPPファイルを連結して返す */
async function concatenateVvppFiles(
  format: "zip" | "7z",
  archiveFileParts: string[],
) {
  // -siオプションでの7z解凍はサポートされていないため、
  // ファイルを連結した一次ファイルを作成し、それを7zで解凍する。
  log.log(`Concatenating ${archiveFileParts.length} files...`);
  const tmpConcatenatedFile = path.join(
    app.getPath("temp"), // TODO: archiveFilePartsと同じディレクトリにしてappの依存をなくす
    `vvpp-${new Date().getTime()}.${format}`,
  );
  log.log("Temporary file:", tmpConcatenatedFile);
  await new Promise<void>((resolve, reject) => {
    if (!tmpConcatenatedFile) throw new Error("tmpFile is undefined");
    const inputStreams = archiveFileParts.map((f) => fs.createReadStream(f));
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
  return tmpConcatenatedFile;
}

/** 7zでファイルを解凍する */
async function unarchive(
  payload: {
    archiveFile: string;
    outputDir: string;
    format: "zip" | "7z";
  },
  callbacks?: { onProgress?: ProgressCallback },
) {
  const { archiveFile, outputDir, format } = payload;

  const args = [
    "x",
    "-o" + outputDir,
    archiveFile,
    "-t" + format,
    "-bsp1", // 進捗出力
  ];

  let sevenZipPath = import.meta.env.VITE_7Z_BIN_NAME;
  if (!sevenZipPath) {
    throw new Error("7z path is not defined");
  }
  if (import.meta.env.PROD) {
    sevenZipPath = path.join(path.dirname(app.getPath("exe")), sevenZipPath); // TODO: helperに移動してappの依存をなくす
  }
  log.log("Spawning 7z:", sevenZipPath, args.join(" "));
  await new Promise<void>((resolve, reject) => {
    const child = spawn(sevenZipPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data: Buffer) => {
      const output = data.toString("utf-8");
      log.info(`7z STDOUT: ${output}`);

      // 進捗を取得
      // NOTE: ` 75% 106 - pyopenjtalk\open_jtalk_dic_utf_8-1.11\sys.dic` のような出力が来る
      // TODO: 出力が変わるかもしれないのでテストが必要
      const progressMatch = output.match(
        / *(?<percent>\d+)% ?(?<fileCount>\d+)? ?(?<file>.*)/,
      );
      if (progressMatch?.groups?.percent) {
        callbacks?.onProgress?.({
          progress: parseInt(progressMatch.groups.percent),
        });
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      log.error(`7z STDERR: ${data.toString("utf-8")}`);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        callbacks?.onProgress?.({ progress: 100 });
        resolve();
      } else {
        reject(new Error(`7z exited with code ${code}`));
      }
    });
    // FIXME: rejectが2回呼ばれることがある
    child.on("error", reject);
  });
}

export async function extractVvpp(
  vvppLikeFilePath: string,
  vvppEngineDir: string,
  callbacks?: { onProgress?: ProgressCallback },
): Promise<{ outputDir: string; manifest: MinimumEngineManifestType }> {
  callbacks?.onProgress?.({ progress: 0 });

  const nonce = new Date().getTime().toString();
  const outputDir = path.join(vvppEngineDir, ".tmp", nonce);

  const archiveFileParts = await getArchiveFileParts(vvppLikeFilePath);

  const format = await detectFileFormat(archiveFileParts[0]);
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
        tmpConcatenatedFile = await concatenateVvppFiles(
          format,
          archiveFileParts,
        );
        archiveFile = tmpConcatenatedFile;
      } else {
        archiveFile = archiveFileParts[0];
        log.log("Single file, not concatenating");
      }

      await unarchive({ archiveFile, outputDir, format }, callbacks);
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

async function detectFileFormat(
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
