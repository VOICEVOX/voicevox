import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Target } from "electron-builder";

const createIni = (sizes: number[], hashes: string[]) => {
  const ini = ["[files]", `n=${sizes.length}`];
  hashes.forEach((v, i) => ini.push(`hash${i}=${v.toUpperCase()}`));
  sizes.forEach((v, i) => ini.push(`size${i}=${v}`));
  return ini.join("\r\n") + "\r\n";
};

export default async function splitNsisArchive(target: Target) {
  const projectName = process.env.npm_package_name;
  if (projectName == undefined) {
    const errorMessage = "Project name is undefined.";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  const projectVersion = process.env.npm_package_version;
  if (projectVersion == undefined) {
    const ErrorMessage = "Project version is undefined.";
    console.error(ErrorMessage);
    throw new Error(ErrorMessage);
  }
  const segmentSize = 1 * 1024 ** 3; // 1GB
  const fileName = `${projectName}-${projectVersion}-x64.nsis.7z`; // target file name
  const targetDirectory = target.outDir; // for nsis-web
  const outputDirectory = path.resolve(targetDirectory, "out");
  const inputFile = path.resolve(targetDirectory, fileName);

  console.log("Splitting NSIS Archive...");
  const inputStream = fs.createReadStream(inputFile, {
    encoding: undefined,
    highWaterMark: segmentSize,
  });

  let fileIndex = 0;
  const sizes: number[] = [];
  const hashes: string[] = [];
  inputStream.on("data", (chunk) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fs.stat(outputDirectory, (err, _) => {
      if (err) {
        if (err.code === "ENOENT") {
          // Create directory if output directory not found.
          fs.mkdirSync(outputDirectory, { recursive: true });
        } else {
          // Something error happened.
          console.error(err);
          throw err;
        }
      }

      const outputFilePath = path
        .resolve(outputDirectory, fileName)
        .concat(".", fileIndex.toString());
      const outputStream = fs.createWriteStream(outputFilePath, {
        flags: "w+",
        encoding: undefined,
      });

      outputStream.write(chunk);
      outputStream.end();

      fileIndex += 1;
      sizes.push(chunk.length);
      const hash = crypto.createHash("md5");
      hashes.push(hash.update(chunk).digest("hex"));
    });
  });

  inputStream.on("end", () => {
    const iniFilePath = path.resolve(outputDirectory, fileName).concat(".ini");
    fs.writeFileSync(iniFilePath, createIni(sizes, hashes));
    console.log("Finished NSIS Archive split.");
  });
}
