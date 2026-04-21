/**
 * OSに合った7-Zipのバイナリとライセンスをダウンロードするスクリプト。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { retryFetch } from "./helper.js";

const distPath = path.join(import.meta.dirname, "..", "vendored", "7z");
const versionFilePath = path.join(distPath, "version.txt");
const sevenZipVersion = "26.00";
const sevenZipAssetVersion = sevenZipVersion.replace(".", "");
const sevenZipReleaseBaseUrl =
  "https://github.com/ip7z/7zip/releases/download/" + sevenZipVersion;

function getPlatformDownloadInfo(): {
  url: string;
  filesToExtract: string[];
  bootstrapUrl?: string;
} {
  switch (process.platform) {
    case "win32": {
      return {
        // 7za.exeは7z形式で圧縮されているので、展開用に7zr.exeも取得する。
        bootstrapUrl: `${sevenZipReleaseBaseUrl}/7zr.exe`,
        url: `${sevenZipReleaseBaseUrl}/7z${sevenZipAssetVersion}-extra.7z`,
        // 7za.dll、7zxa.dllはなくても動くので、除外する
        filesToExtract: ["7za.exe", "License.txt"],
      };
    }
    case "linux": {
      switch (os.arch()) {
        case "arm64": {
          return {
            url: `${sevenZipReleaseBaseUrl}/7z${sevenZipAssetVersion}-linux-arm64.tar.xz`,
            filesToExtract: ["7zzs", "License.txt"],
          };
        }
        case "x64": {
          return {
            url: `${sevenZipReleaseBaseUrl}/7z${sevenZipAssetVersion}-linux-x64.tar.xz`,
            filesToExtract: ["7zzs", "License.txt"],
          };
        }
        default: {
          throw new Error("Unsupported architecture for Linux");
        }
      }
    }
    case "darwin": {
      return {
        url: `${sevenZipReleaseBaseUrl}/7z${sevenZipAssetVersion}-mac.tar.xz`,
        filesToExtract: ["7zz", "License.txt"],
      };
    }
    default: {
      throw new Error("Unsupported platform");
    }
  }
}

async function shouldDownload(filesToExtract: string[]) {
  const versionMatches = await fs.promises
    .readFile(versionFilePath, "utf-8")
    .then((version) => version === sevenZipVersion)
    .catch(() => false);

  if (!versionMatches) {
    return true;
  }

  const existingFiles = await fs.promises.readdir(distPath);
  return filesToExtract.some((file) => !existingFiles.includes(file));
}

async function downloadBinary(url: string, outputPath: string) {
  const res = await retryFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download binary: ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  await fs.promises.writeFile(outputPath, Buffer.from(buffer));
}

const { url, filesToExtract, bootstrapUrl } = getPlatformDownloadInfo();

if (await shouldDownload(filesToExtract)) {
  await fs.promises.rm(distPath, { force: true, recursive: true });
  await fs.promises.mkdir(distPath, { recursive: true });

  if (bootstrapUrl) {
    const sevenzrPath = path.join(distPath, "7zr.exe");
    console.log("Downloading 7zr from " + bootstrapUrl);
    await downloadBinary(bootstrapUrl, sevenzrPath);
  }

  console.log("Downloading 7z from " + url);
  const sevenZipPath = path.join(distPath, path.basename(url));
  await downloadBinary(url, sevenZipPath);

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

  await fs.promises.writeFile(versionFilePath, sevenZipVersion);
} else {
  console.log("7z already downloaded");
}
