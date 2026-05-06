/**
 * OSに合った7-Zipのバイナリとライセンスをダウンロードするスクリプト。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { retryFetch, verifySha256 } from "./helper.js";

const distPath = path.join(import.meta.dirname, "..", "vendored", "7z");
const versionFilePath = path.join(distPath, "version.txt");
const sevenZipVersion = "26.00";
const sevenZipAssetVersion = sevenZipVersion.replace(".", "");
const sevenZipReleaseBaseUrl =
  "https://github.com/ip7z/7zip/releases/download/" + sevenZipVersion;

function getPlatformDownloadInfo(): {
  url: string;
  sha256: string;
  filesToExtract: string[];
  bootstrap?: { url: string; sha256: string };
} {
  switch (process.platform) {
    case "win32": {
      return {
        // 7za.exeは7z形式で圧縮されているので、展開用に7zr.exeも取得する。
        bootstrap: {
          url: `${sevenZipReleaseBaseUrl}/7zr.exe`,
          sha256:
            "4bec0bc59836a890a11568b58bd12a3e7b23a683557340562da211b6088058ba",
        },
        url: `${sevenZipReleaseBaseUrl}/7z${sevenZipAssetVersion}-extra.7z`,
        // 7za.dll、7zxa.dllはなくても動くので、除外する
        sha256:
          "1cc38a9e3777ce0e4bbf84475672888a581d400633b0448fd973a7a6aa56cfdc",
        filesToExtract: ["7za.exe", "License.txt"],
      };
    }
    case "linux": {
      switch (os.arch()) {
        case "arm64": {
          return {
            url: `${sevenZipReleaseBaseUrl}/7z${sevenZipAssetVersion}-linux-arm64.tar.xz`,
            sha256:
              "aa8f3d0a19af9674d3af0ec788b4e261501071e626cd75ad149f1c2c176cc87d",
            filesToExtract: ["7zzs", "License.txt"],
          };
        }
        case "x64": {
          return {
            url: `${sevenZipReleaseBaseUrl}/7z${sevenZipAssetVersion}-linux-x64.tar.xz`,
            sha256:
              "c74dc4a48492cde43f5fec10d53fb2a66f520e4a62a69d630c44cb22c477edc6",
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
        sha256:
          "8a2ea734b52b2cb7d568f5f13e0a137bea3004b221bdbee53197728a9051c849",
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

async function downloadBinary(
  url: string,
  outputPath: string,
  expectedSha256: string,
) {
  const res = await retryFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download binary: ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  verifySha256(buffer, expectedSha256);
  await fs.promises.writeFile(outputPath, Buffer.from(buffer));
}

const { url, sha256, filesToExtract, bootstrap } = getPlatformDownloadInfo();

if (await shouldDownload(filesToExtract)) {
  await fs.promises.rm(distPath, { force: true, recursive: true });
  await fs.promises.mkdir(distPath, { recursive: true });

  if (bootstrap) {
    const sevenzrPath = path.join(distPath, "7zr.exe");
    console.log("Downloading 7zr from " + bootstrap.url);
    await downloadBinary(bootstrap.url, sevenzrPath, bootstrap.sha256);
  }

  console.log("Downloading 7z from " + url);
  const sevenZipPath = path.join(distPath, path.basename(url));
  await downloadBinary(url, sevenZipPath, sha256);

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
