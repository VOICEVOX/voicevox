/**
 * OSに合ったjactionlintのバイナリとライセンスをダウンロードするスクリプト。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { retryFetch, verifySha256 } from "./helper.js";

const vendoredPath = path.join(import.meta.dirname, "..", "vendored");
const distPath = path.join(vendoredPath, "jactionlint");
const versionFilePath = path.join(distPath, "version.txt");
const jactionlintVersion = "2.2.0";
const jactionlintReleaseBaseUrl = `https://github.com/jdx/jactionlint/releases/download/v${jactionlintVersion}`;

const platformNames: Partial<Record<NodeJS.Platform, string>> = {
  win32: "windows",
  linux: "linux",
  darwin: "darwin",
};
const archNames: Partial<Record<string, string>> = {
  x64: "amd64",
  arm64: "arm64",
};
// jactionlint_{バージョン}_checksums.txt に記載されているSHA256
const sha256s: Partial<Record<string, string>> = {
  windows_amd64:
    "97300770d2bea28110736e34edfc9a21d80840090af64dc4b6116b6467f537a4",
  windows_arm64:
    "c23e76e2382f9d5ae6b2a0d74df80b2e13179a62bee4885f5ca4eedf2a85b588",
  linux_amd64:
    "8137d5bfe266dd5e48d2af2306827785ce07c6988e04b1c3d6ad4776e97d27d2",
  linux_arm64:
    "6d4c3831cc360b14550fb2f4605b4de9d2761515cd3fd5c1da718528b314647d",
  darwin_amd64:
    "74efa76b1c200a2b7778c28e9aa0c3ba1c843863006a2f8916f252f8c048d42b",
  darwin_arm64:
    "622b29b15a59618bc032163073209ffc434252e9a19eafd451e69207a50f266a",
};

function getPlatformDownloadInfo(): {
  url: string;
  sha256: string;
  filesToExtract: string[];
} {
  const target = `${platformNames[process.platform]}_${archNames[os.arch()]}`;
  const sha256 = sha256s[target];
  if (sha256 == undefined) {
    throw new Error(`Unsupported platform: ${process.platform} ${os.arch()}`);
  }
  const isWindows = process.platform === "win32";
  const extension = isWindows ? "zip" : "tar.gz";
  return {
    url: `${jactionlintReleaseBaseUrl}/jactionlint_${jactionlintVersion}_${target}.${extension}`,
    sha256,
    // jactionlintはactionlintのフォークなので、LICENSE.txtとNOTICE.mdに両方の著作権表示がある
    filesToExtract: [
      isWindows ? "jactionlint.exe" : "jactionlint",
      "LICENSE.txt",
      "NOTICE.md",
    ],
  };
}

async function shouldDownload(filesToExtract: string[]) {
  const versionMatches = await fs.promises
    .readFile(versionFilePath, "utf-8")
    .then((version) => version === jactionlintVersion)
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

const { url, sha256, filesToExtract } = getPlatformDownloadInfo();

if (await shouldDownload(filesToExtract)) {
  await fs.promises.rm(distPath, { force: true, recursive: true });
  await fs.promises.mkdir(distPath, { recursive: true });

  console.log("Downloading jactionlint from " + url);
  const archivePath = path.join(distPath, path.basename(url));
  await downloadBinary(url, archivePath, sha256);

  console.log("Extracting jactionlint");
  // Windows用はzipなので、tools/download7z.tsでダウンロードした7zで展開する
  const extractor = archivePath.endsWith(".zip")
    ? spawnSync(
        path.join(vendoredPath, "7z", "7za.exe"),
        ["x", "-y", "-o" + distPath, archivePath, ...filesToExtract],
        {
          stdio: ["ignore", "inherit", "inherit"],
        },
      )
    : spawnSync(
        "tar",
        ["xzf", archivePath, "-C", distPath, ...filesToExtract],
        {
          stdio: ["ignore", "inherit", "inherit"],
        },
      );

  if (extractor.status !== 0) {
    console.error("Failed to extract jactionlint");
    process.exit(1);
  }

  await fs.promises.rm(archivePath);
  await fs.promises.writeFile(versionFilePath, jactionlintVersion);
} else {
  console.log("jactionlint already downloaded");
}
