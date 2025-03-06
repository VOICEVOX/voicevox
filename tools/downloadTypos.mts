/**
 * OSに合ったtyposのバイナリをダウンロードするスクリプト。
 */
import { exec } from "child_process";
import { promisify } from "util";
import { platform, arch } from "os";
import { join, resolve } from "path";
import fsSync from "fs";
import fs from "fs/promises";
import { Readable } from "stream";
import { ReadableStream } from "stream/web";
import { pipeline } from "stream/promises";
import { retryFetch } from "./helper.mjs";

// OS名を定義するオブジェクト
const OS = {
  LINUX: "linux",
  MACOS: "darwin",
  WINDOWS: "win32",
};
// CPUアーキテクチャ名を定義するオブジェクト
const CPU_ARCHITECTURE = {
  X86_64: "x86_64",
  ARM: "aarch64",
};
// ダウンロードしたバイナリを格納するディレクトリ
const BINARY_BASE_PATH = resolve(import.meta.dirname, "..", "vendored");
// typosのバイナリを格納するディレクトリ
const TYPOS_DIRECTORY_PATH = resolve(BINARY_BASE_PATH, "typos");
const TYPOS_VERSION = "v1.30.0";

// 各OSとアーキテクチャに対応するtyposバイナリのターゲットトリプル
const TYPOS_TARGET_TRIPLES = {
  [OS.MACOS]: {
    [CPU_ARCHITECTURE.ARM]: "aarch64-apple-darwin",
    [CPU_ARCHITECTURE.X86_64]: "x86_64-apple-darwin",
  },
  [OS.LINUX]: {
    [CPU_ARCHITECTURE.ARM]: "aarch64-unknown-linux-musl",
    [CPU_ARCHITECTURE.X86_64]: "x86_64-unknown-linux-musl",
  },
  [OS.WINDOWS]: {
    [CPU_ARCHITECTURE.X86_64]: "x86_64-pc-windows-msvc",
  },
};

// 動作環境でのOSとCPUアーキテクチャ
const currentOS = platform();
const currentCpuArchitecture =
  arch() === "arm64" ? CPU_ARCHITECTURE.ARM : CPU_ARCHITECTURE.X86_64;
// 7zバイナリのパス
// WARNING: linuxとmacで異なるバイナリでないとエラーが出る
const sevenZipBinaryName =
  currentOS === OS.WINDOWS
    ? "7za.exe"
    : currentOS === OS.MACOS
      ? "7zz"
      : "7zzs";
const sevenZipBinaryPath = join(BINARY_BASE_PATH, "7z", sevenZipBinaryName);
// 非同期でOSコマンドを処理するための関数
const execAsync = promisify(exec);

async function exists(path: string) {
  return fs
    .access(path)
    .then(() => true)
    .catch(() => false);
}

/**
 * コマンドを実行し、その進行状況を出力するヘルパー関数
 */
async function runCommand({
  command,
  description,
}: {
  command: string;
  description: string;
}) {
  console.log(`Running: ${description}`);
  try {
    await execAsync(command);
  } catch (error) {
    console.error(`An error occurred: ${String(error)}`);
    throw error;
  }
}

/**
 * 現在のOSとアーキテクチャに基づいてバイナリのダウンロード先URLを定数のオブジェクトから取得する関数
 */
function getBinaryURL() {
  const baseUrl = "https://github.com/crate-ci/typos/releases/download";
  const targetTriple = TYPOS_TARGET_TRIPLES[currentOS][currentCpuArchitecture];
  const extension = currentOS === OS.WINDOWS ? ".zip" : ".tar.gz";

  const url = `${baseUrl}/${TYPOS_VERSION}/typos-${TYPOS_VERSION}-${targetTriple}${extension}`;

  if (!url) {
    throw new Error(
      `Unsupported OS or architecture: ${currentOS}, ${currentCpuArchitecture}`,
    );
  }

  return url;
}

/**
 * Typosのダウンロードが必要か判定する関数
 * @returns {Promise<boolean>} Typosのダウンロードが必要か
 */
async function needsDownloadTypos(): Promise<boolean> {
  // TYPOS_BINARY_PATHが存在する場合、typosのバージョンをチェック
  if (await exists(TYPOS_DIRECTORY_PATH)) {
    const currentVersion = await fs
      .readFile(resolve(TYPOS_DIRECTORY_PATH, ".typos-version"), "utf-8")
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") {
          return ""; // バージョンファイルが存在しない場合は空文字列を返却
        }
        throw error;
      });
    if (currentVersion === TYPOS_VERSION) {
      return false;
    }

    console.log(
      "The downloaded version of typos differs from the specified version, so it will be re-downloaded",
    );
    // 既にダウンロードされているtyposが指定のバージョンと異なる場合、それを削除
    try {
      const files = await fs.readdir(TYPOS_DIRECTORY_PATH);
      await Promise.all(
        files.map((file) => fs.unlink(resolve(TYPOS_DIRECTORY_PATH, file))),
      );
    } catch (error) {
      console.error("Error removing downloaded typos:", error);
    }
  } else {
    await fs.mkdir(TYPOS_DIRECTORY_PATH, { recursive: true });
  }
  return true;
}

/**
 * バイナリをダウンロードして解凍し、実行権限を付与する関数
 */
async function downloadAndUnarchive({ url }: { url: string }) {
  if (!(await needsDownloadTypos())) {
    console.log("typos already downloaded");
    return;
  }

  const response = await retryFetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download binary: ${response.statusText}`);
  }

  const responseStream = Readable.fromWeb(response.body as ReadableStream);
  const compressedFilePath = `${TYPOS_DIRECTORY_PATH}/typos${currentOS === OS.WINDOWS ? ".zip" : ".tar.gz"}`;
  const fileStream = fsSync.createWriteStream(compressedFilePath);
  await pipeline(responseStream, fileStream);

  if (currentOS === OS.WINDOWS) {
    // Windows用のZIPファイルを解凍
    await runCommand({
      command: `"${sevenZipBinaryPath}" x ${compressedFilePath} -o${TYPOS_DIRECTORY_PATH}`,
      description: `Extracting typos binary`,
    });
  } else {
    const archiveFilePath = `${TYPOS_DIRECTORY_PATH}/typos.tar`;

    // .tar.gzファイルの解凍
    await runCommand({
      command: `"${sevenZipBinaryPath}" e ${compressedFilePath} -o${TYPOS_DIRECTORY_PATH} -y`,
      description: `Extracting typos.tar.gz file`,
    });

    // tarファイルの解凍
    await runCommand({
      command: `"${sevenZipBinaryPath}" x ${archiveFilePath} -o${TYPOS_DIRECTORY_PATH} -y`,
      description: `Extracting typos.tar file`,
    });

    // バイナリに実行権限を付与
    await runCommand({
      command: `chmod +x ${TYPOS_DIRECTORY_PATH}/typos`,
      description: `Granting execute permissions to typos binary`,
    });

    // 解凍後にアーカイブファイルを削除
    await fs.rm(archiveFilePath);
  }

  // typosのバージョンを保存
  const versionFile = resolve(TYPOS_DIRECTORY_PATH, ".typos-version");
  await fs.writeFile(versionFile, `${TYPOS_VERSION}`);

  // 解凍後に圧縮ファイルを削除
  await fs.rm(compressedFilePath);
}

/**
 * /vendored/typos ディレクトリから不要なファイルとディレクトリを削除する関数
 */
async function cleanupTyposDirectory() {
  const typosDocDirPath = join(TYPOS_DIRECTORY_PATH, "doc");
  const typosReadmeFilePath = join(TYPOS_DIRECTORY_PATH, "README.md");

  // doc ディレクトリの削除
  if (await exists(typosDocDirPath)) {
    await fs.rm(typosDocDirPath, { recursive: true });
    console.log(`Deleted directory: ${typosDocDirPath}`);
  }

  // README.md ファイルの削除
  if (await exists(typosReadmeFilePath)) {
    await fs.rm(typosReadmeFilePath);
    console.log(`Deleted file: ${typosReadmeFilePath}`);
  }
}

/**
 * OSに応じてバイナリデータを処理する関数
 */
async function main() {
  const url = getBinaryURL();
  await downloadAndUnarchive({ url });

  // 不要なファイルとディレクトリを削除
  await cleanupTyposDirectory();
}

// main関数実行
await main();
