// @ts-check
/**
 * OSに合ったtyposのバイナリをダウンロードするスクリプト。
 */
const { exec } = require("child_process");
const { promisify } = require("util");
const { platform } = require("os");
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
// OSのコマンドを非同期関数として処理させるために必要な関数
const execAsync = promisify(exec);

/**
 * コマンドを実行し、その進行状況を出力するヘルパー関数
 *
 * @param {string} command - 実行するシェルコマンド
 * @param {string} description - コマンドの説明を表示するテキスト
 */
async function runCommand(command, description) {
  console.log(`実行中: ${description} ...`);
  try {
    await execAsync(command);
  } catch (error) {
    console.error(`エラーが発生しました: ${error.message}`);
    throw error;
  }
}

/**
 * バイナリをダウンロードして解凍し、実行権限を付与する関数
 *
 * @param {Object} binaries - バイナリの情報を含むオブジェクト
 * @param {Function} downloadBinaryFunction - OSに応じたバイナリのダウンロード関数
 */
async function processBinaries(binaries, downloadBinaryFunction) {
  // 各バイナリを非同期で並行してダウンロードする
  await Promise.all(
    binaries.map(async (binary) => {
      // もしバイナリが既に存在する場合、ダウンロードをスキップする
      const binaryPath = join(BINARY_BASE_PATH, binary.name);
      let binaryFilePath;

      // OSに応じたバイナリを確認し、存在するならダウンロードをスキップする
      switch (platform()) {
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
          throw new Error("サポートされていないOSです");
      }

      if (existsSync(binaryFilePath)) {
        console.log(`${binary.name} already downloaded`);
        return;
      }

      try {
        console.log(`${binary.name} のダウンロードURLを取得中...`);
        const url = await getBinaryURL(binary.repo, binary.version);

        await downloadBinaryFunction({ name: binary.name, url });
      } catch (err) {
        console.error(
          `${binary.name} のインストール中にエラーが発生しました: ${err.message}`,
        );
      }
    }),
  );
}

/**
 * GitHub APIを使って、リポジトリのリリースから特定のOSのダウンロードURLを取得する関数
 *
 * @param {string} repo - GitHubリポジトリの名前（例: 'crate-ci/typos'）
 * @param {string} [version='latest'] - インストールしたい特定のバージョン（省略した場合は最新バージョン）
 * @returns {Promise<Object>} 特定のOSに対応するバイナリのダウンロードURL
 */
async function getBinaryURL(repo, version = "latest") {
  const apiUrl =
    version === "latest"
      ? `https://api.github.com/repos/${repo}/releases/latest`
      : `https://api.github.com/repos/${repo}/releases/tags/${version}`;

  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(
      `指定されたバージョン "${version}" のリリース情報が見つかりませんでした。`,
    );
  }

  const data = await response.json();

  const url = {
    linux: null,
    darwin: null,
    win32: null,
  };

  data.assets.forEach((asset) => {
    if (asset.name.includes("linux")) url.linux = asset.browser_download_url;
    else if (asset.name.includes("apple-darwin"))
      url.darwin = asset.browser_download_url;
    else if (asset.name.includes("windows"))
      url.win32 = asset.browser_download_url;
  });

  return url;
}

/**
 * Linuxに合わせたバイナリをダウンロードするための関数
 * @param {Object} binary - バイナリの情報を含むオブジェクト
 */
async function downloadBinaryForLinux({ name, url }) {
  const binaryPath = join(BINARY_BASE_PATH, name);
  const tarballPath = `${binaryPath}/${name}.tar.gz`;

  // もし各バイナリのディレクトリがないなら新しく作成する
  if (!existsSync(binaryPath)) {
    mkdirSync(binaryPath, { recursive: true });
  }

  await runCommand(
    `curl -L ${url.linux} -o ${tarballPath}`,
    `${name}バイナリのダウンロード`,
  );
  await runCommand(
    `tar -xzvf ${tarballPath} -C ${binaryPath}`,
    "バイナリの解凍",
  );
  await runCommand(
    `chmod +x ${binaryPath}/${name}`,
    "バイナリに実行権限を付与",
  );

  // 解凍後に圧縮ファイルを削除
  unlinkSync(tarballPath);
}

/**
 * Windowsに合わせたバイナリをダウンロードするための関数
 * @param {Object} binary - バイナリの情報を含むオブジェクト
 */
async function downloadBinaryForWin({ name, url }) {
  const binaryPath = join(BINARY_BASE_PATH, name);
  const zipFilePath = `${binaryPath}\\${name}.zip`;

  // もし各バイナリのディレクトリがないなら新しく作成する
  if (!existsSync(binaryPath)) {
    mkdirSync(binaryPath, { recursive: true });
  }

  await runCommand(
    `curl -L ${url.win32} -o ${zipFilePath}`,
    `${name}バイナリのダウンロード`,
  );
  await runCommand(
    `"${SEVEN_ZIP_BINARY_PATH}" x ${zipFilePath} -o${binaryPath}`,
    "zipファイルを解凍中...",
  );

  // 解凍後に圧縮ファイルを削除
  unlinkSync(zipFilePath);
}

/**
 * macOSに合わせたバイナリをダウンロードするための関数
 * @param {Object} binary - バイナリの情報を含むオブジェクト
 */
async function downloadBinaryForMac({ name, url }) {
  const binaryPath = join(BINARY_BASE_PATH, name);
  const tarballPath = `${binaryPath}/${name}.tar.gz`;

  // もし各バイナリのディレクトリがないなら新しく作成する
  if (!existsSync(binaryPath)) {
    mkdirSync(binaryPath, { recursive: true });
  }

  await runCommand(
    `curl -L ${url.darwin} -o ${tarballPath}`,
    `${name}バイナリのダウンロード`,
  );
  await runCommand(
    `tar -xzvf ${tarballPath} -C ${binaryPath}`,
    "バイナリの解凍",
  );
  await runCommand(
    `chmod +x ${binaryPath}/${name}`,
    "バイナリに実行権限を付与",
  );

  // 解凍後に圧縮ファイルを削除
  unlinkSync(tarballPath);
}

/**
 * OSに応じた関数を選択し、バイナリデータを処理する関数
 *
 * @param {Array<Object>} binaries - 複数のバイナリの情報を含む配列オブジェクト
 */
async function main(binaries) {
  let downloadBinaryFunction;

  // OSに応じたインストール関数を選択
  switch (platform()) {
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
      throw new Error("サポートされていないOSです");
  }

  // バイナリデータを処理
  await processBinaries(binaries, downloadBinaryFunction);
}

// main関数実行
(async () => {
  await main(WANT_TO_DOWNLOAD_BINARIES);
})();
