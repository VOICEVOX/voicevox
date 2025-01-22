/**
 * VVPPファイルを扱うモジュール。
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import MultiStream from "multistream";
import { glob } from "glob";
import { app } from "electron";
import {
  minimumEngineManifestSchema,
  MinimumEngineManifestType,
} from "@/type/preload";
import { ProgressCallback } from "@/helpers/progressHelper";
import { createLogger } from "@/helpers/log";

const log = createLogger("vvppFile");

/** VVPPファイルが分割されている場合、それらのファイルを取得する */
async function getArchiveFileParts(
  vvppLikeFilePath: string,
): Promise<string[]> {
  // 名前.数値.vvpppの場合は分割されているとみなして連結する
  if (isSplitFile(vvppLikeFilePath)) {
    log.info("vvpp is split, finding other parts...");
    const filePaths = await findSplitFileParts(vvppLikeFilePath);
    return sortFileParts(filePaths);
  } else {
    log.info("Not a split file");
    return [vvppLikeFilePath];
  }

  function isSplitFile(filePath: string): boolean {
    return filePath.match(/\.[0-9]+\.vvppp$/) != null;
  }

  async function findSplitFileParts(filePath: string): Promise<string[]> {
    const vvpppPathGlob = filePath
      .replace(/\.[0-9]+\.vvppp$/, ".*.vvppp")
      .replace(/\\/g, "/"); // node-globはバックスラッシュを使えないので、スラッシュに置換する
    const filePaths: string[] = [];
    for (const p of await glob(vvpppPathGlob)) {
      if (!p.match(/\.[0-9]+\.vvppp$/)) {
        continue;
      }
      log.info(`found ${p}`);
      filePaths.push(p);
    }
    return filePaths;
  }

  function sortFileParts(filePaths: string[]): string[] {
    return filePaths.sort((a, b) => {
      const aMatch = a.match(/\.([0-9]+)\.vvppp$/);
      const bMatch = b.match(/\.([0-9]+)\.vvppp$/);
      if (aMatch == null || bMatch == null) {
        throw new Error(`match is null: a=${a}, b=${b}`);
      }
      return parseInt(aMatch[1]) - parseInt(bMatch[1]);
    });
  }
}

/** 分割されているVVPPファイルを連結して返す */
async function concatenateVvppFiles(
  archiveFileParts: string[],
  outputFilePath: string,
) {
  log.info(`Concatenating ${archiveFileParts.length} files...`);

  await new Promise<void>((resolve, reject) => {
    const inputStreams = archiveFileParts.map((f) => fs.createReadStream(f));
    const outputStream = fs.createWriteStream(outputFilePath);
    new MultiStream(inputStreams)
      .pipe(outputStream)
      .on("close", () => {
        outputStream.close();
        resolve();
      })
      .on("error", reject);
  });
  log.info("Concatenated");
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
  const args = createSevenZipArgs();
  const sevenZipPath = getSevenZipPath();

  log.info("Spawning 7z:", sevenZipPath, args.join(" "));
  await spawnSevenZip(sevenZipPath, args, callbacks);

  function createSevenZipArgs(): string[] {
    const { archiveFile, outputDir, format } = payload;
    return [
      "x",
      "-o" + outputDir,
      archiveFile,
      "-t" + format,
      "-bsp1", // 進捗出力
    ];
  }

  function getSevenZipPath(): string {
    let sevenZipPath = import.meta.env.VITE_7Z_BIN_NAME;
    if (!sevenZipPath) {
      throw new Error("7z path is not defined");
    }
    if (import.meta.env.PROD) {
      sevenZipPath = path.join(path.dirname(app.getPath("exe")), sevenZipPath);
    }
    return sevenZipPath;
  }

  async function spawnSevenZip(
    sevenZipPath: string,
    args: string[],
    callbacks?: { onProgress?: ProgressCallback },
  ) {
    const { promise, resolve, reject } = Promise.withResolvers<void>();

    const child = spawn(sevenZipPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data: Buffer) => {
      handleStdout(data, callbacks);
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

    await promise;
  }

  function handleStdout(
    data: Buffer,
    callbacks?: { onProgress?: ProgressCallback },
  ) {
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
  }
}

async function unarchiveVvppFiles(
  payload: {
    archiveFileParts: string[];
    outputDir: string;
    tmpDir: string;
    format: "zip" | "7z";
  },
  callbacks?: { onProgress?: ProgressCallback },
) {
  const { archiveFileParts, outputDir, tmpDir, format } = payload;
  if (archiveFileParts.length > 1) {
    // -siオプションでの7z解凍はサポートされていないため、
    // ファイルを連結した一次ファイルを作成し、それを7zで解凍する。
    const archiveFile = createTmpConcatenatedFilePath();
    log.info("Temporary file:", archiveFile);

    try {
      await concatenateVvppFiles(archiveFileParts, archiveFile);
      await unarchive({ archiveFile, outputDir, format }, callbacks);
    } finally {
      log.info("Removing temporary file", archiveFile);
      await fs.promises.rm(archiveFile);
    }
  } else {
    const archiveFile = archiveFileParts[0];
    log.info("Single file, not concatenating");

    await unarchive({ archiveFile, outputDir, format }, callbacks);
  }

  function createTmpConcatenatedFilePath(): string {
    return path.join(tmpDir, `vvpp-${new Date().getTime()}.${format}`);
  }
}

/** VVPPファイルを vvppEngineDir で指定したディレクトリ以下の .tmp ディレクトリに展開する */
export async function extractVvpp(
  payload: { vvppLikeFilePath: string; vvppEngineDir: string; tmpDir: string },
  callbacks?: { onProgress?: ProgressCallback },
): Promise<{ outputDir: string; manifest: MinimumEngineManifestType }> {
  const { vvppLikeFilePath, vvppEngineDir, tmpDir } = payload;
  callbacks?.onProgress?.({ progress: 0 });

  const outputDir = createOutputDirPath();
  const archiveFileParts = await getArchiveFileParts(vvppLikeFilePath);

  const format = await detectFileFormat(archiveFileParts[0]);
  if (!format) {
    throw new Error(`Unknown file format: ${archiveFileParts[0]}`);
  }
  log.info("Format:", format);

  try {
    await unarchiveVvppFiles({
      archiveFileParts,
      outputDir,
      tmpDir,
      format,
    });
    const manifest = await readManifest(outputDir);
    return { outputDir, manifest };
  } catch (e) {
    await cleanupOutputDir(outputDir);
    throw e;
  }

  function createOutputDirPath(): string {
    const nonce = new Date().getTime().toString();
    const outputDir = path.join(vvppEngineDir, ".tmp", nonce);
    return outputDir;
  }

  async function readManifest(
    outputDir: string,
  ): Promise<MinimumEngineManifestType> {
    return minimumEngineManifestSchema.parse(
      JSON.parse(
        await fs.promises.readFile(
          path.join(outputDir, "engine_manifest.json"),
          "utf-8",
        ),
      ),
    );
  }

  async function cleanupOutputDir(outputDir: string) {
    if (fs.existsSync(outputDir)) {
      log.info("Failed to extract vvpp, removing", outputDir);
      await fs.promises.rm(outputDir, { recursive: true });
    }
  }
}

async function detectFileFormat(
  filePath: string,
): Promise<"zip" | "7z" | undefined> {
  const buffer = await readFileHeader(filePath);

  // https://www.garykessler.net/library/file_sigs.html#:~:text=7-zip%20compressed%20file
  const SEVEN_ZIP_MAGIC_NUMBER = Buffer.from([
    0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c,
  ]);
  const ZIP_MAGIC_NUMBER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

  if (isBufferEqual(buffer, SEVEN_ZIP_MAGIC_NUMBER, 6)) {
    return "7z";
  } else if (isBufferEqual(buffer, ZIP_MAGIC_NUMBER, 4)) {
    return "zip";
  }
  return undefined;

  async function readFileHeader(filePath: string): Promise<Buffer> {
    const file = await fs.promises.open(filePath, "r");
    const buffer = Buffer.alloc(8);
    await file.read(buffer, 0, 8, 0);
    await file.close();
    return buffer;
  }

  function isBufferEqual(
    buffer1: Buffer,
    buffer2: Buffer,
    length: number,
  ): boolean {
    return buffer1.compare(buffer2, 0, length, 0, length) === 0;
  }
}
