import process from "process";
import fs from "fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = await yargs(hideBin(process.argv))
  .option("output_path", {
    alias: "o",
    demandOption: true,
    type: "string",
  })
  .option("input_path", {
    alias: "i",
    demandOption: true,
    type: "string",
  })
  .help()
  .parse();

const inputPathList =
  typeof argv.input_path === "string" ? [argv.input_path] : argv.input_path;

type License = {
  name: string;
  version: string;
  license: string;
  text: string;
};
let mergedLicenses: License[] = [];

for (const inputPath of inputPathList) {
  const licenseJson = fs.readFileSync(inputPath, {
    encoding: "utf-8",
  });

  const licenses = JSON.parse(licenseJson) as License[];
  mergedLicenses = mergedLicenses.concat(licenses);
}

const outputPath = argv.output_path;
fs.writeFileSync(outputPath, JSON.stringify(mergedLicenses));
