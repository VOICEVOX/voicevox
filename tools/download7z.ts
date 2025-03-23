/**
 * OSに合った7-Zipのバイナリとライセンスをダウンロードするスクリプト。
 */
import { spawnSync } from "child_process";
import fs from "fs";
import { arch } from "os";
import path from "path";
import { retryFetch } from "./helper.mjs";

const distPath = path.join(import.meta.dirname, "..", "vendored", "7z");
let url;
let filesToExtract;

await fs.promises.mkdir(distPath, { recursive: true });
switch (process.platform) {
  case "win32": {
    // 7za.exeは7z形式で圧縮されているので、7zr.exeが必要になる。
    // Mac/Linuxと違い、インストーラー以外には7z形式でしか配布されていない。
    // Actionsでインストーラーを動かすことはできないので、単独で配布されている7zr.exeを使い、
    // 7z形式で圧縮されている7za.exeを展開する。
    const sevenzrUrl = "https://www.7-zip.org/a/7zr.exe";
    const sevenzrPath = path.join(distPath, "7zr.exe");
    if (!fs.existsSync(sevenzrPath)) {
      console.log("Downloading 7zr from " + sevenzrUrl);
      const res = await retryFetch(sevenzrUrl);
      if (!res.ok) {
        throw new Error(`Failed to download binary: ${res.statusText}`);
      }
      const buffer = await res.arrayBuffer();

      await fs.promises.writeFile(sevenzrPath, Buffer.from(buffer));
    }

    url = "https://www.7-zip.org/a/7z2201-extra.7z";
    // 7za.dll、7zxa.dllはなくても動くので、除外する
    // filesToExtract = ["7za.exe", "7za.dll", "7zxa.dll", "License.txt"];
    filesToExtract = ["7za.exe", "License.txt"];

    break;
  }
  case "linux": {
    switch (arch()) {
      case "arm64": {
        url = "https://www.7-zip.org/a/7z2201-linux-arm64.tar.xz";
        break;
      }
      case "x64": {
        url = "https://www.7-zip.org/a/7z2201-linux-x64.tar.xz";
        break;
      }
      default: {
        throw new Error("Unsupported architecture for Linux");
      }
    }
    filesToExtract = ["7zzs", "License.txt"];
    break;
  }
  case "darwin": {
    url = "https://www.7-zip.org/a/7z2107-mac.tar.xz";
    filesToExtract = ["7zz", "License.txt"];
    break;
  }
  default: {
    throw new Error("Unsupported platform");
  }
}

const existingFiles = await fs.promises.readdir(distPath);

const notDownloaded = filesToExtract.filter(
  (file) => !existingFiles.includes(file),
);

if (notDownloaded.length === 0) {
  console.log("7z already downloaded");
  process.exit(0);
}

console.log("Downloading 7z from " + url);
const res = await retryFetch(url);
if (!res.ok) {
  throw new Error(`Failed to download binary: ${res.statusText}`);
}
const buffer = await res.arrayBuffer();
const sevenZipPath = path.join(distPath, path.basename(url));
await fs.promises.writeFile(sevenZipPath, Buffer.from(buffer));

console.log("Extracting 7z");
const extractor = url.endsWith(".7z")
  ? spawnSync(
      path.join(distPath, "7zr.exe"),
      ["x", "-y", "-o" + distPath, sevenZipPath, ...filesToExtract],
      {
        stdio: ["ignore", "inherit", "inherit"],
      },
    )
  : spawnSync(
      "tar",
      ["xvf", sevenZipPath, "-v", "-C", distPath, ...filesToExtract],
      {
        stdio: ["ignore", "inherit", "inherit"],
      },
    );

if (extractor.status !== 0) {
  console.error("Failed to extract 7z");
  process.exit(1);
}
