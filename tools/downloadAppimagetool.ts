import fs from "node:fs/promises";
import path from "node:path";
import { retryFetch } from "./helper";

const APPIMAGETOOL_VERSION = "1.9.0";

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

function getDownloadURL() {
  const arch: Record<string, string> = {
    arm: "armhf",
    arm64: "aarch64",
    ia32: "i686",
    x64: "x86_64",
  };
  return `https://github.com/AppImage/appimagetool/releases/download/${APPIMAGETOOL_VERSION}/appimagetool-${arch[process.arch]}.AppImage`;
}

async function main() {
  if (await isDownloaded()) {
    console.log("appimagetool already downloaded");
    return;
  }
  await fs.mkdir(distDir, { recursive: true });
  const url = getDownloadURL();
  const result = await retryFetch(url);
  const data = await result.bytes();
  await fs.writeFile(appimagetoolPath, data, { mode: 0o755 });
  await fs.writeFile(versionFilePath, APPIMAGETOOL_VERSION);
}

if (process.platform === "linux") {
  await main();
}
