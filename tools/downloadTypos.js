// @ts-check
/**
 * OSに合ったtyposのバイナリをダウンロードするスクリプト。
 */
const { exec } = require("child_process");
const { promisify } = require("util");
const { platform, arch } = require("os");
const { join, resolve } = require("path");
const {
  mkdirSync,
  existsSync,
  unlinkSync,
  createWriteStream,
  rmSync,
} = require("fs");
const fetch = require("node-fetch");

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
const BINARY_BASE_PATH = resolve(__dirname, "vendored");
// typosのバイナリのパス
const TYPOS_BINARY_PATH = resolve(BINARY_BASE_PATH, "typos");
// 各OSとアーキテクチャに対応するtyposバイナリのダウンロードURL
const TYPOS_URLS = {
  [OS.MACOS]: {
    [CPU_ARCHITECTURE.ARM]:
      "https://github.com/crate-ci/typos/releases/download/v1.21.0/typos-v1.21.0-aarch64-apple-darwin.tar.gz",
    [CPU_ARCHITECTURE.X86_64]:
      "https://github.com/crate-ci/typos/releases/download/v1.21.0/typos-v1.21.0-x86_64-apple-darwin.tar.gz",
  },
  [OS.LINUX]: {
    [CPU_ARCHITECTURE.X86_64]:
      "https://github.com/crate-ci/typos/releases/download/v1.21.0/typos-v1.21.0-x86_64-unknown-linux-musl.tar.gz",
  },
  [OS.WINDOWS]: {
    [CPU_ARCHITECTURE.X86_64]:
      "https://github.com/crate-ci/typos/releases/download/v1.21.0/typos-v1.21.0-x86_64-pc-windows-msvc.zip",
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

/**
 * コマンドを実行し、その進行状況を出力するヘルパー関数
 * @param {Object} params - コマンド実行のパラメータ
 * @param {string} params.command - 実行するシェルコマンド
 * @param {string} params.description - コマンドの説明を表示するテキスト
 */
async function runCommand({ command, description }) {
  console.log(`Running: ${description}`);
  try {
    await execAsync(command);
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
    throw error;
  }
}

/**
 * 現在のOSとアーキテクチャに基づいてバイナリのダウンロード先URLを定数のオブジェクトから取得する関数
 * @returns {string} バイナリをダウンロードするためのURL
 */
function getBinaryURL() {
  const url = TYPOS_URLS[currentOS][currentCpuArchitecture];

  if (!url) {
    throw new Error(
      `Unsupported OS or architecture: ${currentOS}, ${currentCpuArchitecture}`,
    );
  }

  return url;
}

/**
 * バイナリをダウンロードして解凍し、実行権限を付与する関数
 * @param {Object} params - バイナリの情報を含むオブジェクト
 * @param {string} params.url - ダウンロード先URL
 */
async function downloadAndUnarchive({ url }) {
  const compressedFilePath = `${TYPOS_BINARY_PATH}/typos${currentOS === OS.WINDOWS ? ".zip" : ".tar.gz"}`;

  // バイナリディレクトリが存在する場合ダウンロードをスキップし、存在しない場合はディレクトリを作成する
  if (existsSync(TYPOS_BINARY_PATH)) {
    console.log(`typos already downloaded`);
    return;
  } else {
    mkdirSync(TYPOS_BINARY_PATH, { recursive: true });
  }

  // node-fetchでバイナリをメモリ上にダウンロードした後、ローカルに保存する
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download binary: ${response.statusText}`);
  }

  const fileStream = createWriteStream(compressedFilePath);
  await new Promise((resolve, reject) => {
    response.body.pipe(fileStream);
    response.body.on("error", reject);
    fileStream.on("finish", resolve);
  });

  if (currentOS === OS.WINDOWS) {
    // Windows用のZIPファイルを解凍
    await runCommand({
      command: `"${sevenZipBinaryPath}" x ${compressedFilePath} -o${TYPOS_BINARY_PATH}`,
      description: `Extracting typos binary`,
    });
  } else {
    const archiveFilePath = `${TYPOS_BINARY_PATH}/typos.tar`;

    // .tar.gzファイルの解凍
    await runCommand({
      command: `"${sevenZipBinaryPath}" e ${compressedFilePath} -o${TYPOS_BINARY_PATH} -y`,
      description: `Extracting typos.tar.gz file`,
    });

    // tarファイルの解凍
    await runCommand({
      command: `"${sevenZipBinaryPath}" x ${archiveFilePath} -o${TYPOS_BINARY_PATH} -y`,
      description: `Extracting typos.tar file`,
    });

    // バイナリに実行権限を付与
    await runCommand({
      command: `chmod +x ${TYPOS_BINARY_PATH}/typos`,
      description: `Granting execute permissions to typos binary`,
    });

    // 解凍後にアーカイブファイルを削除
    unlinkSync(archiveFilePath);
  }

  // 解凍後に圧縮ファイルを削除
  unlinkSync(compressedFilePath);
}

/**
 * /build/vendored/typos ディレクトリから不要なファイルとディレクトリを削除する関数
 */
function cleanupTyposDirectory() {
  const typosDocDirPath = join(TYPOS_BINARY_PATH, "doc");
  const typosReadmeFilePath = join(TYPOS_BINARY_PATH, "README.md");

  // doc ディレクトリの削除
  if (existsSync(typosDocDirPath)) {
    rmSync(typosDocDirPath, { recursive: true });
    console.log(`Deleted directory: ${typosDocDirPath}`);
  }

  // README.md ファイルの削除
  if (existsSync(typosReadmeFilePath)) {
    unlinkSync(typosReadmeFilePath);
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
  cleanupTyposDirectory();
}

// main関数実行
(async () => {
  await main();
})();
