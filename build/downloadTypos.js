// @ts-check
/**
 * OSに合ったtyposのバイナリをダウンロードするスクリプト。
 */
const { exec } = require("child_process");
const { promisify } = require("util");
const { platform, arch } = require("os");
const { join, resolve } = require("path");
const { mkdirSync, existsSync, unlinkSync } = require("fs");

// OS名を定義するオブジェクト
const OS = {
  LINUX: "linux",
  MACOS: "darwin",
  WINDOWS: "win32",
};
// CPUアーキテクチャ名を定義するオブジェクト
const CPU_ARCHITECTURE = {
  x86_64: "x86_64",
  arm: "aarch64",
};
// 現在のOSとCPUアーキテクチャ
const CURRENT_OS = platform();
const CURRENT_CPU_ARCHITECTURE =
  arch() === "arm64" ? CPU_ARCHITECTURE.ARM : CPU_ARCHITECTURE.X86_64;
// 全バイナリのパス
const BINARY_BASE_PATH = resolve(__dirname, "vendored");
// typosのバイナリのパス
const TYPOS_BINARY_PATH = resolve(BINARY_BASE_PATH, "typos");
// 7zバイナリのパス linuxとmacで異なるバイナリでないとエラーが出ることに注意
const SEVEN_ZIP_BINARY_NAME =
  CURRENT_OS === OS.WINDOWS ? "7za.exe" : OS.MACOS ? "7zz" : "7zzs";
const SEVEN_ZIP_BINARY_PATH = join(
  BINARY_BASE_PATH,
  "7z",
  SEVEN_ZIP_BINARY_NAME,
);
// 各OSとアーキテクチャに対応するtyposバイナリのダウンロード先URL
const TYPOS_URLS = {
  [OS.MACOS]: {
    [CPU_ARCHITECTURE.ARM]:
      "https://github.com/crate-ci/typos/releases/download/v1.23.7/typos-v1.23.7-aarch64-apple-darwin.tar.gz",
    [CPU_ARCHITECTURE.X86_64]:
      "https://github.com/crate-ci/typos/releases/download/v1.23.7/typos-v1.23.7-x86_64-apple-darwin.tar.gz",
  },
  [OS.LINUX]:
    "https://github.com/crate-ci/typos/releases/download/v1.23.7/typos-v1.23.7-x86_64-unknown-linux-musl.tar.gz",
  [OS.WINDOWS]:
    "https://github.com/crate-ci/typos/releases/download/v1.23.7/typos-v1.23.7-x86_64-pc-windows-msvc.zip",
};

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
  let url;

  switch (CURRENT_OS) {
    case OS.MACOS:
      url = TYPOS_URLS[OS.MACOS][CURRENT_CPU_ARCHITECTURE];
      break;
    case OS.LINUX:
      url = TYPOS_URLS[OS.LINUX];
      break;
    case OS.WINDOWS:
      url = TYPOS_URLS[OS.WINDOWS];
      break;
    default:
      throw new Error(`Unsupported OS: ${CURRENT_OS}`);
  }

  if (typeof url !== "string") {
    throw new Error("Failed to determine the download URL.");
  }

  return url;
}

/**
 * バイナリをダウンロードして解凍し、実行権限を付与する関数
 * @param {Object} params - バイナリの情報を含むオブジェクト
 * @param {string} params.url - ダウンロード先URL
 */
async function downloadBinary({ url }) {
  const compressedFilePath = `${TYPOS_BINARY_PATH}/typos${CURRENT_OS === OS.WINDOWS ? ".zip" : ".tar.gz"}`;

  // バイナリディレクトリが存在する場合ダウンロードをスキップし、存在しない場合はディレクトリを作成する
  if (existsSync(TYPOS_BINARY_PATH)) {
    console.log(`typos already downloaded`);
    return;
  } else {
    mkdirSync(TYPOS_BINARY_PATH, { recursive: true });
  }

  await runCommand({
    command: `curl -L ${url} -o ${compressedFilePath}`,
    description: `Downloading typos binary`,
  });

  if (CURRENT_OS === OS.WINDOWS) {
    // Windows用のZIPファイルを解凍
    await runCommand({
      command: `"${SEVEN_ZIP_BINARY_PATH}" x ${compressedFilePath} -o${TYPOS_BINARY_PATH}`,
      description: `Extracting typos binary`,
    });
  } else {
    const archiveFilePath = `${TYPOS_BINARY_PATH}/typos.tar`;

    // .tar.gzファイルの解凍
    await runCommand({
      command: `"${SEVEN_ZIP_BINARY_PATH}" e ${compressedFilePath} -o${TYPOS_BINARY_PATH} -y`,
      description: `Extracting typos.tar.gz file`,
    });

    // tarファイルの解凍
    await runCommand({
      command: `"${SEVEN_ZIP_BINARY_PATH}" x ${archiveFilePath} -o${TYPOS_BINARY_PATH} -y`,
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
 * OSに応じてバイナリデータを処理する関数
 */
async function main() {
  const url = getBinaryURL();
  await downloadBinary({ url });
}

// main関数実行
(async () => {
  await main();
})();
