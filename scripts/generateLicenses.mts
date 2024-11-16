import process from "process";
import { execFileSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import licenseChecker, { ModuleInfos } from "license-checker-rseidelsohn";

const argv = await yargs(hideBin(process.argv))
  .option("output_path", {
    alias: "o",
    demandOption: true,
    type: "string",
  })
  .help()
  .parse();

const disallowedLicenses = ["GPL", "GPL-2.0", "GPL-3.0", "AGPL", "NGPL"];

const licenseJson: ModuleInfos = await new Promise((resolve, reject) => {
  licenseChecker.init(
    {
      start: process.cwd(),
      production: true,
      failOn: disallowedLicenses.join(";"),
      excludePrivatePackages: true,
      customFormat: {
        name: "",
        version: "",
        description: "",
        licenses: "",
        copyright: "",
        licenseFile: "none",
        licenseText: "none",
        licenseModified: "no",
      },
    },
    (err, json) => {
      if (err) {
        reject(err);
      } else {
        resolve(json);
      }
    },
  );
});

const externalLicenses = [];
// 型を曖昧にして下の[process.platform]のエラーを回避する
const sevenZipBinNames: Record<string, string> = {
  win32: "7za.exe",
  linux: "7zzs",
  darwin: "7zz",
};
const sevenZipBinName = sevenZipBinNames[process.platform];
if (!sevenZipBinName) {
  throw new Error(`Unsupported platform: ${process.platform}`);
}

const sevenZipVersionMatch = execFileSync(
  path.join(
    import.meta.dirname,
    "..",
    "build",
    "vendored",
    "7z",
    sevenZipBinName,
  ),

  {
    encoding: "utf-8",
  },
).match(/7-Zip\s+(?:\(.\))?\s*([0-9.]+)/);

if (!sevenZipVersionMatch) {
  throw new Error("Failed to find 7-Zip version");
}

externalLicenses.push({
  name: "7-Zip",
  version: sevenZipVersionMatch[1],
  license: "LGPL-2.1",
  text: await fs.readFile(
    path.join(__dirname, "vendored", "7z", "License.txt"),
    {
      encoding: "utf-8",
    },
  ),
});

const licenses = Object.entries(licenseJson)
  .map(([, license]) => ({
    name: license.name,
    version: license.version,
    license: license.licenses,
    text: license.licenseText,
  }))
  .concat(externalLicenses);

const outputPath = argv.output_path;
await fs.writeFile(outputPath, JSON.stringify(licenses));
console.log(`Wrote licenses to ${outputPath}`);
