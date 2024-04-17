/* eslint-disable @typescript-eslint/no-var-requires */

const process = require("process");
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const argv = yargs(hideBin(process.argv))
  .option("output_path", {
    alias: "o",
    demandOption: true,
    type: "string",
  })
  .help()
  .parse();

const tmp = require("tmp");

const isWindows = process.platform === "win32";

const customFormat = {
  name: "",
  version: "",
  description: "",
  licenses: "",
  copyright: "",
  licenseFile: "none",
  licenseText: "none",
  licenseModified: "no",
};

const customFormatFile = tmp.fileSync();
fs.writeFileSync(customFormatFile.name, JSON.stringify(customFormat));

const disallowedLicenses = ["GPL", "GPL-2.0", "GPL-3.0", "AGPL", "NGPL"];

// On Windows, npm's global packages can be called with the extension `.cmd` or `.ps1`.
// On Linux (bash), they can be called without extensions.
const extension = isWindows ? ".cmd" : "";

// https://github.com/davglass/license-checker
// npm install -g license-checker
const licenseJson = execFileSync(
  `license-checker${extension}`,
  [
    "--production",
    "--excludePrivatePackages",
    "--json",
    `--customPath=${customFormatFile.name}`,
    `--failOn=${disallowedLicenses.join(";")}`,
  ],
  {
    encoding: "utf-8",
    maxBuffer: 1024 * 1024 * 10, // FIXME: stdoutではなくファイル出力にする
  },
);

const checkerLicenses = JSON.parse(licenseJson);

const externalLicenses = [];

externalLicenses.push({
  name: "7-Zip",
  version: execFileSync(
    path.join(
      __dirname,
      "vendored",
      "7z",
      {
        win32: "7za.exe",
        linux: "7zzs",
        darwin: "7zz",
      }[process.platform],
    ),

    {
      encoding: "utf-8",
    },
  ).match(/7-Zip\s+(?:\(.\))?\s*([0-9.]+)/)[1],
  license: "LGPL-2.1",
  text: fs.readFileSync(path.join(__dirname, "vendored", "7z", "License.txt"), {
    encoding: "utf-8",
  }),
});

const licenses = Object.entries(checkerLicenses)
  .map(([, license]) => ({
    name: license.name,
    version: license.version,
    license: license.licenses,
    text: license.licenseText,
  }))
  .concat(externalLicenses);

const outputPath = argv.output_path;
fs.writeFileSync(outputPath, JSON.stringify(licenses));
