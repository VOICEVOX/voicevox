const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

(async () => {
  // node-fetchはESModuleなので、import()で読み込む
  const { default: fetch } = await import("node-fetch");
  const distPath = path.resolve(__dirname, "vendored", "7z");
  let url;
  let filesToExtract;
  switch (process.platform) {
    case "win32": {
      url = "https://www.7-zip.org/a/7z2201-extra.7z";
      filesToExtract = ["7za.exe", "7za.dll", "7zxa.dll", "License.txt"];
      break;
    }
    case "linux": {
      url = "https://www.7-zip.org/a/7z2201-linux-x64.tar.xz";
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
    (file) => !existingFiles.includes(file)
  );

  if (notDownloaded.length === 0) {
    console.log("7z already downloaded");
    return;
  }

  console.log("Downloading 7z from " + url);
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const sevenZipPath = path.resolve(distPath, path.basename(url));
  await fs.promises.writeFile(sevenZipPath, Buffer.from(buffer));

  console.log("Extracting 7z");
  const extractor = url.endsWith(".7z")
    ? spawnSync(
        path.resolve(__dirname, "7zr.exe"),
        ["x", "-y", "-o" + distPath, sevenZipPath, ...filesToExtract],
        {
          stdio: ["ignore", "inherit", "inherit"],
        }
      )
    : spawnSync(
        "tar",
        ["xvf", sevenZipPath, "-v", "-C", distPath, ...filesToExtract],
        {
          stdio: ["ignore", "inherit", "inherit"],
        }
      );

  if (extractor.status !== 0) {
    console.error("Failed to extract 7z");
    process.exit(1);
  }
})();
