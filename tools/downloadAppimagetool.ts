import fs from "node:fs/promises";
import path from "node:path";
import { retryFetch, verifySha256 } from "./helper";

const APPIMAGETOOL_VERSION = "1.9.1";

const distDir = path.join(
  import.meta.dirname,
  "..",
  "vendored",
  "appimagetool",
);
const appimagetoolPath = path.join(distDir, "appimagetool.AppImage");
const versionFilePath = path.join(distDir, "version.txt");

async function isDownloaded() {
  try {
    await fs.access(appimagetoolPath);
    await fs.access(versionFilePath);
  } catch {
    return false;
  }
  const currentVersion = await fs.readFile(versionFilePath, "utf-8");
  if (currentVersion !== APPIMAGETOOL_VERSION) {
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
        "42b61cba5495d8aaf418a5c9a015a49b85ad92efabcbd3c341f1540440e4e23d",
    },
    arm64: {
      archKey: "aarch64",
      sha256:
        "f0837e7448a0c1e4e650a93bb3e85802546e60654ef287576f46c71c126a9158",
    },
    ia32: {
      archKey: "i686",
      sha256:
        "7ad9ff47c203aae0149b18f6df9e3018b2e2f470ea644a0413e3ded39e9e3bdb",
    },
    x64: {
      archKey: "x86_64",
      sha256:
        "ed4ce84f0d9caff66f50bcca6ff6f35aae54ce8135408b3fa33abfc3cb384eb0",
    },
  };
  const info = archInfoMap[process.arch];
  return {
    url: `https://github.com/AppImage/appimagetool/releases/download/${APPIMAGETOOL_VERSION}/appimagetool-${info.archKey}.AppImage`,
    sha256: info.sha256,
  };
}

async function main() {
  if (await isDownloaded()) {
    console.log("appimagetool already downloaded");
    return;
  }
  await fs.mkdir(distDir, { recursive: true });
  const { url, sha256 } = getDownloadInfo();
  const result = await retryFetch(url);
  const data = await result.bytes();
  verifySha256(data, sha256);
  await fs.writeFile(appimagetoolPath, data, { mode: 0o755 });
  await fs.writeFile(versionFilePath, APPIMAGETOOL_VERSION);
}

if (process.platform === "linux") {
  await main();
}
