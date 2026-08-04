/**
 * OSに合ったtyposのバイナリをダウンロードするスクリプト。
 */
import { exec } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { retryFetch, verifySha256 } from "./helper.js";

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
const BINARY_BASE_PATH = path.join(import.meta.dirname, "..", "vendored");
// typosのバイナリを格納するディレクトリ
const TYPOS_DIRECTORY_PATH = path.join(BINARY_BASE_PATH, "typos");
// typosのバージョンを保存しておくテキストファイル
const TYPOS_VERSION_FILE_NAME = "version.txt";

const TYPOS_VERSION = "v1.43.4";

// 動作環境でのOSとCPUアーキテクチャ
const currentOS = os.platform();
const currentCpuArchitecture =
  os.arch() === "arm64" ? CPU_ARCHITECTURE.ARM : CPU_ARCHITECTURE.X86_64;
// 7zバイナリのパス
// WARNING: linuxとmacで異なるバイナリでないとエラーが出る
const sevenZipBinaryName =
  currentOS === OS.WINDOWS
    ? "7za.exe"
    : currentOS === OS.MACOS
      ? "7zz"
      : "7zzs";
const sevenZipBinaryPath = path.join(
  BINARY_BASE_PATH,
  "7z",
  sevenZipBinaryName,
);
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
 * 現在のOSとアーキテクチャに基づいてバイナリのダウンロード情報を返す関数
 */
function getDownloadInfo(): { url: string; sha256: string } {
  const downloadInfoMap: Record<
    string,
    Record<string, { triplet: string; sha256: string }>
  > = {
    [OS.MACOS]: {
      [CPU_ARCHITECTURE.ARM]: {
        triplet: "aarch64-apple-darwin",
        sha256:
          "bd5b1e04de8710813464cc510fd33a2e4a797320901d23f49042e1d1863ef023",
      },
      [CPU_ARCHITECTURE.X86_64]: {
        triplet: "x86_64-apple-darwin",
        sha256:
          "24e104185f1522d1906f7e8299e43e39faefe527dbe73b163cfaadad8012a113",
      },
    },
    [OS.LINUX]: {
      [CPU_ARCHITECTURE.ARM]: {
        triplet: "aarch64-unknown-linux-musl",
        sha256:
          "7eeb93b5dbd4590ef60f6a09ab94e0dae70d2f333c0447284f1cad0379786f5b",
      },
      [CPU_ARCHITECTURE.X86_64]: {
        triplet: "x86_64-unknown-linux-musl",
        sha256:
          "f05f9da84ba714789271a2915060f8b7d329411b5c11e83b8d2c367ef592036c",
      },
    },
    [OS.WINDOWS]: {
      [CPU_ARCHITECTURE.X86_64]: {
        triplet: "x86_64-pc-windows-msvc",
        sha256:
          "6f1e5688724d347bfbb6419cc76c364b54a97afef75cdbcf02cc838852dbb6cd",
      },
    },
  };

  const info = downloadInfoMap[currentOS]?.[currentCpuArchitecture];

  if (!info) {
    throw new Error(
      `Unsupported OS or architecture: ${currentOS}, ${currentCpuArchitecture}`,
    );
  }
  const extension = currentOS === OS.WINDOWS ? ".zip" : ".tar.gz";
  const url = `https://github.com/crate-ci/typos/releases/download/${TYPOS_VERSION}/typos-${TYPOS_VERSION}-${info.triplet}${extension}`;
  return { url, sha256: info.sha256 };
}

/**
 * Typosのダウンロードが必要か判定する関数
 * @returns {Promise<boolean>} Typosのダウンロードが必要か
 */
async function shouldDownloadTypos(): Promise<boolean> {
  if (!(await exists(TYPOS_DIRECTORY_PATH))) {
    return true;
  }

  // TYPOS_BINARY_PATHが存在する場合、typosのバージョンをチェック
  const versionFilePath = path.join(
    TYPOS_DIRECTORY_PATH,
    TYPOS_VERSION_FILE_NAME,
  );
  if (!(await exists(versionFilePath))) {
    return true;
  }

  const currentVersion = await fs.readFile(versionFilePath, "utf-8");
  if (currentVersion === TYPOS_VERSION) {
    return false;
  }

  console.log(
    "The downloaded version of typos differs from the specified version, so it will be re-downloaded",
  );
  return true;
}

/**
 * Typosのダウンロード前にディレクトリを準備する関数
 * 既存のディレクトリがある場合は中身を空にし、無い場合は新規作成する
 */
async function prepareTyposDirectory() {
  // TYPOS_DIRECTORY_PATHが存在する場合、中身を空にする
  if (await exists(TYPOS_DIRECTORY_PATH)) {
    const files = await fs.readdir(TYPOS_DIRECTORY_PATH);
    await Promise.all(
      files.map((file) => fs.unlink(path.join(TYPOS_DIRECTORY_PATH, file))),
    );
  } else {
    // 無い場合は新規作成する
    await fs.mkdir(TYPOS_DIRECTORY_PATH, { recursive: true });
  }
}

/**
 * バイナリをダウンロードして解凍し、実行権限を付与する関数
 */
async function downloadAndUnarchive({
  url,
  sha256,
}: {
  url: string;
  sha256: string;
}) {
  if (!(await shouldDownloadTypos())) {
    console.log("typos already downloaded");
    return;
  }

  await prepareTyposDirectory();

  const response = await retryFetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download binary: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  verifySha256(buffer, sha256);

  const compressedFilePath = `${TYPOS_DIRECTORY_PATH}/typos${currentOS === OS.WINDOWS ? ".zip" : ".tar.gz"}`;
  await fs.writeFile(compressedFilePath, Buffer.from(buffer));

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
  const versionFilePath = path.join(
    TYPOS_DIRECTORY_PATH,
    TYPOS_VERSION_FILE_NAME,
  );
  await fs.writeFile(versionFilePath, TYPOS_VERSION);

  // 解凍後に圧縮ファイルを削除
  await fs.rm(compressedFilePath);
}

/**
 * /vendored/typos ディレクトリから不要なドキュメントを削除する関数
 * ダウンロード・解凍後に実行する
 */
async function removeTyposDocumentation() {
  const typosDocDirPath = path.join(TYPOS_DIRECTORY_PATH, "doc");
  const typosReadmeFilePath = path.join(TYPOS_DIRECTORY_PATH, "README.md");

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
  const { url, sha256 } = getDownloadInfo();
  await downloadAndUnarchive({ url, sha256 });

  // 不要なドキュメントを削除
  await removeTyposDocumentation();
}

// main関数実行
await main();
