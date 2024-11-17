// @ts-check
/* eslint-disable @typescript-eslint/no-var-requires */

const process = require("process");
const { execFileSync } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");

const argv = yargs(hideBin(process.argv))
  .option("output_path", {
    alias: "o",
    demandOption: true,
    type: "string",
  })
  .help()
  .parse();

const licenseChecker = require("license-checker-rseidelsohn");

(async () => {
  const disallowedLicenses = ["GPL", "GPL-2.0", "GPL-3.0", "AGPL", "NGPL"];

  /** @type {licenseChecker.ModuleInfos} */
  const licenseJson = await new Promise((resolve, reject) => {
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

  const sevenZipVersionMatch = execFileSync(
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
})();
