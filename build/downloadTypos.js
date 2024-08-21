// @ts-check
/**
 * OSに合ったtyposのバイナリをダウンロードするスクリプト。
 */
const { exec } = require("child_process");
const { promisify } = require("util");
const { platform, arch } = require("os");
const { join, resolve } = require("path");
const { mkdirSync, existsSync, unlinkSync } = require("fs");
const fetch = require("node-fetch");

// 全バイナリデータのパス
const BINARY_BASE_PATH = resolve(__dirname, "vendored");
// 7zのバイナリデータのパス
const SEVEN_ZIP_BINARY_PATH = join(BINARY_BASE_PATH, "7z", "7za.exe");
// ダウンロードしたいバイナリデータの配列オブジェクト
const WANT_TO_DOWNLOAD_BINARIES = [
  {
    name: "typos",
    repo: "crate-ci/typos",
    version: "latest",
  },
  // {
  //   name: 'anotherBinary',
  //   repo: 'some-other-repo/some-binary',
  //   version: 'v1.2.3', // 指定したバージョン
  // }
];
// OS名を定義するオブジェクト
const OS = {
  LINUX: "linux",
  MACOS: "darwin",
  WINDOWS: "win32",
};
// 動作しているPCのOS文字列
const CURRENT_OS = platform();
// 動作しているOSのCPUアーキテクチャ文字列
const CURRENT_CPU_ARCHITECTURE = arch();
// OSのコマンドを非同期関数として処理させるために必要な関数
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
    console.error(`An error occured: ${error.message}`);
    throw error;
  }
}

/**
 * バイナリをダウンロードして解凍し、実行権限を付与する関数
 *
 * @param {Object} params - バイナリをダウンロードするための情報を含むオブジェクト
 * @param {Array<Object>} params.binaries - バイナリの情報を含む配列オブジェクト
 * @param {Function} params.downloadBinaryFunction - OSに応じたバイナリのダウンロード関数
 */
async function processBinaries({ binaries, downloadBinaryFunction }) {
  // 各バイナリを非同期で並行してダウンロードする
  await Promise.all(
    binaries.map(async (binary) => {
      // もしバイナリが既に存在する場合、ダウンロードをスキップする
      const binaryPath = join(BINARY_BASE_PATH, binary.name);
      let binaryFilePath;

      // OSに応じたバイナリを確認し、存在するならダウンロードをスキップする
      switch (CURRENT_OS) {
        case OS.LINUX:
          binaryFilePath = `${binaryPath}/${binary.name}`;
          break;
        case OS.MACOS:
          binaryFilePath = `${binaryPath}/${binary.name}`;
          break;
        case OS.WINDOWS:
          binaryFilePath = `${binaryPath}\\${binary.name}.exe`;
          break;
        default:
          throw new Error("Unsupported OS");
      }

      if (existsSync(binaryFilePath)) {
        console.log(`${binary.name} already downloaded`);
        return;
      }

      try {
        console.log(`Fetching download URL for ${binary.name}`);
        const url = await getBinaryURL({
          repo: binary.repo,
          version: binary.version,
        });

        await downloadBinaryFunction({ name: binary.name, url });
      } catch (err) {
        console.error(
          `An error occurred during ${binary.name} installation: ${err.message}`,
        );
      }
    }),
  );
}

/**
 * GitHub APIを使って、リポジトリのリリースから特定のOSのバイナリをダウンロードするURLを取得する関数
 * @param {Object} params - Githubからバイナリをダウンロードするための情報を含むオブジェクト
 * @param {string} params.repo - GitHubリポジトリの名前（例: 'crate-ci/typos'）
 * @param {string} [params.version='latest'] - インストールしたい特定のバージョン（省略した場合は最新バージョン）
 * @returns {Promise<string>} 特定のOSに対応するバイナリのダウンロードするためのURL文字列
 */
async function getBinaryURL({ repo, version = "latest" }) {
  const apiUrl =
    version === "latest"
      ? `https://api.github.com/repos/${repo}/releases/latest`
      : `https://api.github.com/repos/${repo}/releases/tags/${version}`;

  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(
      `Release information for the specified version "${version}" could not be found.`,
    );
  }

  const data = await response.json();

  // Githubのリリース情報から各OSに最適化されたバイナリをダウンロードするURLを定義する
  const asset = data.assets.find((asset) => {
    if (CURRENT_OS === OS.LINUX && asset.name.includes("linux"))
      return true;
    else if (CURRENT_OS === OS.WINDOWS && asset.name.includes("windows"))
      return true;
    else if (
      CURRENT_OS === OS.MACOS &&
      CURRENT_CPU_ARCHITECTURE === "arm64" &&
      asset.name.includes("aarch64-apple-darwin")
    )
      return true;
    else if (
      CURRENT_OS === OS.MACOS &&
      CURRENT_CPU_ARCHITECTURE === "x64" &&
      asset.name.includes("x86_64-apple-darwin")
    )
      return true;
  });

  return asset.browser_download_url;
}

/**
 * Linuxに合わせたバイナリをダウンロードするための関数
 * @param {Object} params - バイナリの情報を含むオブジェクト
 * @param {string} params.name - バイナリの名前
 * @param {string} params.url - 各プラットフォームのダウンロードURL
 */
async function downloadBinaryForLinux({ name, url }) {
  const binaryPath = join(BINARY_BASE_PATH, name);
  const tarballPath = `${binaryPath}/${name}.tar.gz`;

  // もし各バイナリのディレクトリがないなら新しく作成する
  if (!existsSync(binaryPath)) {
    mkdirSync(binaryPath, { recursive: true });
  }

  await runCommand({
    command: `curl -L ${url} -o ${tarballPath}`,
    description: `Downloading ${name} binary`,
  });
  await runCommand({
    command: `tar -xzvf ${tarballPath} -C ${binaryPath}`,
    description: `Extracting ${name} binary`,
  });
  await runCommand({
    command: `chmod +x ${binaryPath}/${name}`,
    description: `Granting execute permissions to the ${name} binary`,
  });

  // 解凍後に圧縮ファイルを削除
  unlinkSync(tarballPath);
}

/**
 * Windowsに合わせたバイナリをダウンロードするための関数
 * @param {Object} params - バイナリの情報を含むオブジェクト
 * @param {string} params.name - バイナリの名前
 * @param {string} params.url - 各プラットフォームのダウンロードURL
 */
async function downloadBinaryForWin({ name, url }) {
  const binaryPath = join(BINARY_BASE_PATH, name);
  const zipFilePath = `${binaryPath}\\${name}.zip`;

  // もし各バイナリのディレクトリがないなら新しく作成する
  if (!existsSync(binaryPath)) {
    mkdirSync(binaryPath, { recursive: true });
  }

  await runCommand({
    command: `curl -L ${url} -o ${zipFilePath}`,
    description: `Downloading ${name} binary`,
  });
  await runCommand({
    command: `"${SEVEN_ZIP_BINARY_PATH}" x ${zipFilePath} -o${binaryPath}`,
    description: `Extracting ${name} binary`,
  });

  // 解凍後に圧縮ファイルを削除
  unlinkSync(zipFilePath);
}

/**
 * macOSに合わせたバイナリをダウンロードするための関数
 * @param {Object} params - バイナリの情報を含むオブジェクト
 * @param {string} params.name - バイナリの名前
 * @param {string} params.url - 各プラットフォームのダウンロードURL
 */
async function downloadBinaryForMac({ name, url }) {
  const binaryPath = join(BINARY_BASE_PATH, name);
  const tarballPath = `${binaryPath}/${name}.tar.gz`;

  // もし各バイナリのディレクトリがないなら新しく作成する
  if (!existsSync(binaryPath)) {
    mkdirSync(binaryPath, { recursive: true });
  }

  await runCommand({
    command: `curl -L ${url} -o ${tarballPath}`,
    description: `Downloading ${name} binary`,
  });
  await runCommand({
    command: `tar -xzvf ${tarballPath} -C ${binaryPath}`,
    description: `Extracting ${name} binary`,
  });
  await runCommand({
    command: `chmod +x ${binaryPath}/${name}`,
    description: `Granting execute permissions to the ${name} binary`,
  });

  // 解凍後に圧縮ファイルを削除
  unlinkSync(tarballPath);
}

/**
 * OSに応じた関数を選択し、バイナリデータを処理する関数
 *
 * @param {Object} params - メイン処理のパラメータ
 * @param {Array<Object>} params.binaries - 複数のバイナリの情報を含む配列オブジェクト
 */
async function main({ binaries }) {
  let downloadBinaryFunction;

  // OSに応じたインストール関数を選択
  switch (CURRENT_OS) {
    case OS.LINUX:
      downloadBinaryFunction = downloadBinaryForLinux;
      break;
    case OS.MACOS:
      downloadBinaryFunction = downloadBinaryForMac;
      break;
    case OS.WINDOWS:
      downloadBinaryFunction = downloadBinaryForWin;
      break;
    default:
      throw new Error("Unsupported OS");
  }

  // バイナリデータを処理
  await processBinaries({ binaries, downloadBinaryFunction });
}

// main関数実行
(async () => {
  await main({ binaries: WANT_TO_DOWNLOAD_BINARIES });
})();
