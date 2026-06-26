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
const sevenZipVersion = "26.01";
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
            "abcf64ae1cbafddb5395e4cdd3bdc7e3e0561d54a0c6380e3dd43bdbffe519a2",
        },
        url: `${sevenZipReleaseBaseUrl}/7z${sevenZipAssetVersion}-extra.7z`,
        // 7za.dll、7zxa.dllはなくても動くので、除外する
        sha256:
          "05cda5442075a7c6ce246ca1bbb9b1f1d6f1787a9559156f9b8b2dad29a86971",
        filesToExtract: ["7za.exe", "License.txt"],
      };
    }
    case "linux": {
      switch (os.arch()) {
        case "arm64": {
          return {
            url: `${sevenZipReleaseBaseUrl}/7z${sevenZipAssetVersion}-linux-arm64.tar.xz`,
            sha256:
              "39f8c9070c300a63c7484d9a983119ef3edf841e1ddf69f1affae29fdec5f612",
            filesToExtract: ["7zzs", "License.txt"],
          };
        }
        case "x64": {
          return {
            url: `${sevenZipReleaseBaseUrl}/7z${sevenZipAssetVersion}-linux-x64.tar.xz`,
            sha256:
              "8ea0fc8a135e7b848e80a4116fe22dff56c8c4518dde1f43cce67f4e340b437a",
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
          "0b6b930dbf82742e3f1014c35072a6b8b3aab183fece348e7f723675f1c5bea2",
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
