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
  .option("input_path", {
    alias: "i",
    demandOption: true,
    type: "string"
  })
  .help()
  .parse();

const fs = require("fs");

const inputPathList = typeof argv.input_path === 'string' ?
  [ argv.input_path ] : argv.input_path;

let mergedLicenses = [];

for (const inputPath of inputPathList) {
  const licenseJson = fs.readFileSync(inputPath, {
    encoding: 'utf-8'
  });

  const licenses = JSON.parse(licenseJson);
  mergedLicenses = mergedLicenses.concat(licenses);
}

outputPath = argv.output_path;
fs.writeFileSync(outputPath, JSON.stringify(mergedLicenses));
