/**
 * AppImageに埋め込むruntimeをダウンロードする。
 * ビルド時にappimagetoolが最新版をダウンロードをしてしまうので、
 * バージョンを固定するために手動でダウンロードする。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { retryFetch, verifySha256 } from "./helper";

const TYPE2_RUNTIME_VERSION = "20251108";

const distDir = path.join(
  import.meta.dirname,
  "..",
  "vendored",
  "type2-runtime",
);
const runtimePath = path.join(distDir, "runtime");
const versionFilePath = path.join(distDir, "version.txt");

async function isDownloaded() {
  try {
    await fs.access(runtimePath);
    await fs.access(versionFilePath);
  } catch {
    return false;
  }
  const currentVersion = await fs.readFile(versionFilePath, "utf-8");
  if (currentVersion !== TYPE2_RUNTIME_VERSION) {
    await fs.rm(distDir, { recursive: true });
    return false;
  }
  return true;
}

function getDownloadInfo(): { url: string; sha256: string } {
  const archInfoMap: Record<string, { archKey: string; sha256: string }> = {
    arm: {
      archKey: "armhf",
      sha256:
        "e9060d37577b8a29914ec12d8740add24e19ff29012fb1fa0f60daf62db0688d",
    },
    arm64: {
      archKey: "aarch64",
      sha256:
        "00cbdfcf917cc6c0ff6d3347d59e0ca1f7f45a6df1a428a0d6d8a78664d87444",
    },
    ia32: {
      archKey: "i686",
      sha256:
        "e72ea0b140a0a16e680713238a6f30aad278b62c4ca17919c554864124515498",
    },
    x64: {
      archKey: "x86_64",
      sha256:
        "2fca8b443c92510f1483a883f60061ad09b46b978b2631c807cd873a47ec260d",
    },
  };
  const info = archInfoMap[process.arch];
  return {
    url: `https://github.com/AppImage/type2-runtime/releases/download/${TYPE2_RUNTIME_VERSION}/runtime-${info.archKey}`,
    sha256: info.sha256,
  };
}

async function main() {
  if (await isDownloaded()) {
    console.log("type2-runtime already downloaded");
    return;
  }
  await fs.mkdir(distDir, { recursive: true });
  const { url, sha256 } = getDownloadInfo();
  const result = await retryFetch(url);
  const data = await result.bytes();
  verifySha256(data, sha256);
  await fs.writeFile(runtimePath, data);
  await fs.writeFile(versionFilePath, TYPE2_RUNTIME_VERSION);
}

if (process.platform === "linux") {
  await main();
}
