/**
 * VVPPファイルを扱うモジュール。
 */

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import MultiStream from "multistream";
import { app } from "electron";
import {
  minimumEngineManifestSchema,
  MinimumEngineManifestType,
} from "@/type/preload";
import { ProgressCallback } from "@/helpers/progressHelper";
import { createLogger } from "@/helpers/log";
import { UnreachableError } from "@/type/utility";

const log = createLogger("vvppFile");

type Format = "zip" | "7z";

/** VVPPファイルを vvppEngineDir で指定したディレクトリ以下の .tmp ディレクトリに展開する */
export class VvppFileExtractor {
  private readonly vvppLikeFilePath: string;
  private readonly outputDir: string;
  private readonly tmpDir: string;
  private readonly callbacks?: { onProgress?: ProgressCallback };

  constructor(params: {
    vvppLikeFilePath: string;
    outputDir: string;
    tmpDir: string;
    callbacks?: { onProgress?: ProgressCallback };
  }) {
    this.vvppLikeFilePath = params.vvppLikeFilePath;
    this.outputDir = params.outputDir;
    this.tmpDir = params.tmpDir;
    this.callbacks = params.callbacks;
  }

  async extract(): Promise<MinimumEngineManifestType> {
    log.info("Extracting vvpp to", this.outputDir);
    const archiveFileParts = await this.getArchiveFileParts();
    const manifest = await this.extractOrCleanup(archiveFileParts);
    return manifest;
  }

  /** VVPPファイルが分割されている場合、それらのファイルを取得する */
  private async getArchiveFileParts(): Promise<string[]> {
    // 名前.数値.vvpppの場合は分割されているとみなして連結する
    const { vvppLikeFilePath } = this;
    if (this.isSplitFile(vvppLikeFilePath)) {
      log.info("vvpp is split, finding other parts...");
      const filePaths = await this.findSplitFileParts(vvppLikeFilePath);
      return this.sortFileParts(filePaths);
    } else {
      log.info("Not a split file");
      return [vvppLikeFilePath];
    }
  }

  private isSplitFile(filePath: string): boolean {
    return filePath.match(/\.[0-9]+\.vvppp$/) != null;
  }

  private async findSplitFileParts(filePath: string): Promise<string[]> {
    const vvpppPathGlob = filePath
      .replace(/\.[0-9]+\.vvppp$/, ".*.vvppp")
      .replace(/\\/g, "/"); // node-globはバックスラッシュを使えないので、スラッシュに置換する
    const filePaths: string[] = [];
    const matchingFiles = await Array.fromAsync(
      fs.promises.glob(vvpppPathGlob),
    );
    for (const p of matchingFiles) {
      if (!p.match(/\.[0-9]+\.vvppp$/)) {
        continue;
      }
      log.info(`found ${p}`);
      filePaths.push(p);
    }

    return filePaths;
  }

  private sortFileParts(filePaths: string[]): string[] {
    return filePaths.sort(
      (a, b) => this.parseFileNumber(a) - this.parseFileNumber(b),
    );
  }

  private parseFileNumber(filePath: string): number {
    const match = filePath.match(/\.([0-9]+)\.vvppp$/);
    if (match == null) {
      throw new UnreachableError(`match is null: filePath=${filePath}`);
    }
    return parseInt(match[1]);
  }

  private async extractOrCleanup(
    archiveFileParts: string[],
  ): Promise<MinimumEngineManifestType> {
    try {
      return await this.extractAndReadManifest(archiveFileParts);
    } catch (e) {
      log.info("Failed to extract vvpp");
      await this.cleanupOutputDir();
      throw e;
    }
  }

  private async extractAndReadManifest(
    archiveFileParts: string[],
  ): Promise<MinimumEngineManifestType> {
    if (archiveFileParts.length > 1) {
      await this.concatenateAndUnarchive(archiveFileParts);
    } else {
      log.info("Single file, not concatenating");
      await this.unarchive(archiveFileParts[0]);
    }

    return await this.readManifest();
  }

  private async concatenateAndUnarchive(archiveFileParts: string[]) {
    // -siオプションでの7z解凍はサポートされていないため、
    // ファイルを連結した一次ファイルを作成し、それを7zで解凍する。
    const tmpConcatenatedFile = this.buildTmpConcatenatedFilePath();
    log.info("Temporary file:", tmpConcatenatedFile);

    try {
      await this.concatenateVvppFiles(archiveFileParts, tmpConcatenatedFile);
      await this.unarchive(tmpConcatenatedFile);
    } finally {
      log.info("Removing temporary file", tmpConcatenatedFile);
      await fs.promises.rm(tmpConcatenatedFile);
    }
  }

  private buildTmpConcatenatedFilePath(): string {
    return path.join(this.tmpDir, `vvpp-${new Date().getTime()}`);
  }

  /** 分割されているVVPPファイルを連結して返す */
  private async concatenateVvppFiles(
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
  private async unarchive(archiveFile: string) {
    const format = await this.detectFileFormat(archiveFile);
    const args = this.buildSevenZipArgs(archiveFile, format);
    const sevenZipPath = this.getSevenZipPath();

    log.info("Spawning 7z:", sevenZipPath, args.join(" "));
    await this.spawnSevenZip(sevenZipPath, args);
  }

  private async detectFileFormat(filePath: string): Promise<Format> {
    const buffer = await this.readFileHeader(filePath);

    // https://www.garykessler.net/library/file_sigs.html#:~:text=7-zip%20compressed%20file
    const SEVEN_ZIP_MAGIC_NUMBER = Buffer.from([
      0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c,
    ]);
    const ZIP_MAGIC_NUMBER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

    let format: Format;
    if (this.isBufferEqual(buffer, SEVEN_ZIP_MAGIC_NUMBER, 6)) {
      format = "7z";
    } else if (this.isBufferEqual(buffer, ZIP_MAGIC_NUMBER, 4)) {
      format = "zip";
    } else {
      throw new Error(`Unknown file format: ${filePath}`);
    }

    log.info("Format:", format);
    return format;
  }

  private async readFileHeader(filePath: string): Promise<Buffer> {
    const file = await fs.promises.open(filePath, "r");
    const buffer = Buffer.alloc(8);
    await file.read(buffer, 0, 8, 0);
    await file.close();
    return buffer;
  }

  private isBufferEqual(
    buffer1: Buffer,
    buffer2: Buffer,
    length: number,
  ): boolean {
    return buffer1.compare(buffer2, 0, length, 0, length) === 0;
  }

  private buildSevenZipArgs(archiveFile: string, format: Format): string[] {
    return [
      "x",
      "-o" + this.outputDir,
      archiveFile,
      "-t" + format,
      "-bsp1", // 進捗出力
    ];
  }

  private getSevenZipPath(): string {
    let sevenZipPath = import.meta.env.VITE_7Z_BIN_NAME;
    if (!sevenZipPath) {
      throw new Error("7z path is not defined");
    }
    if (import.meta.env.PROD) {
      sevenZipPath = path.join(path.dirname(app.getPath("exe")), sevenZipPath);
    }
    return sevenZipPath;
  }

  private async spawnSevenZip(sevenZipPath: string, args: string[]) {
    const { promise, resolve, reject } = Promise.withResolvers<void>();

    const child = spawn(sevenZipPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data: Buffer) => {
      this.handleStdout(data);
    });

    child.stderr?.on("data", (data: Buffer) => {
      log.error(`7z STDERR: ${data.toString("utf-8")}`);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        this.callbacks?.onProgress?.({ progress: 100 });
        resolve();
      } else {
        reject(new Error(`7z exited with code ${code}`));
      }
    });

    // FIXME: rejectが2回呼ばれることがある
    child.on("error", reject);

    await promise;
  }

  private handleStdout(data: Buffer) {
    const output = data.toString("utf-8");
    log.info(`7z STDOUT: ${output}`);

    // 進捗を取得
    // NOTE: ` 75% 106 - pyopenjtalk\open_jtalk_dic_utf_8-1.11\sys.dic` のような出力が来る
    // TODO: 出力が変わるかもしれないのでテストが必要
    const progressMatch = output.match(
      / *(?<percent>\d+)% ?(?<fileCount>\d+)? ?(?<file>.*)/,
    );
    if (progressMatch?.groups?.percent) {
      this.callbacks?.onProgress?.({
        progress: parseInt(progressMatch.groups.percent),
      });
    }
  }

  private async readManifest(): Promise<MinimumEngineManifestType> {
    return minimumEngineManifestSchema.parse(
      JSON.parse(
        await fs.promises.readFile(
          path.join(this.outputDir, "engine_manifest.json"),
          "utf-8",
        ),
      ),
    );
  }

  private async cleanupOutputDir() {
    const { outputDir } = this;
    if (fs.existsSync(outputDir)) {
      log.info("Removing", this.outputDir);
      await fs.promises.rm(outputDir, { recursive: true });
    }
  }
}
