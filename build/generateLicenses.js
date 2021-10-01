/* eslint-disable @typescript-eslint/no-var-requires */

const process = require("process");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const argv = yargs(hideBin(process.argv))
  .option("output_path", {
    alias: "o",
    demandOption: true,
    type: "string"
  })
  .help()
  .parse();

const { execSync } = require("child_process");
const fs = require("fs");
const tmp = require("tmp");

const customFormat = {
  name: "",
  version: "",
  description: "",
  licenses: "",
  copyright: "",
  licenseFile: "none",
  licenseText: "none",
  licenseModified: "no"
};

const customFormatFile = tmp.fileSync();
fs.writeFileSync(customFormatFile.name, JSON.stringify(customFormat));

// https://github.com/davglass/license-checker
// npm install -g license-checker
const licenseJson = execSync(
  `license-checker --production --excludePrivatePackages --json --customPath ${customFormatFile.name}`,
  {
    encoding: "utf-8"
  }
);

const checkerLicenses = JSON.parse(licenseJson);

const licenses = Object.entries(checkerLicenses).map(([packageName, license]) => ({
  name: license.name,
  version: license.version,
  license: license.licenses,
  text: license.licenseText,
}));

const outputPath = argv.output_path;
fs.writeFileSync(outputPath, JSON.stringify(licenses));
