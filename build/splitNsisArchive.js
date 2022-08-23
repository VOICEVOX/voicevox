/* eslint-disable @typescript-eslint/no-var-requires */
const crypto = require('crypto');
const fs = require("fs");
const path = require("path");

const createIni = (sizes, hashes) => {
  const ini = ['[files]', `n=${sizes.length}`];
  hashes.forEach((v, i) => ini.push(`hash${i}=${v.toUpperCase()}`));
  sizes.forEach((v, i) => ini.push(`size${i}=${v}`));
  return ini.join("\r\n") + "\r\n";
};

// target: electron-builder.Target
exports.default = async function (target) {
  const projectName = process.env.npm_package_name;
  if (projectName === undefined) {
    const ErrorMessage = "Project name is undefined.";
    console.error(ErrorMessage);
    throw ErrorMessage;
  }
  const projectVersion = process.env.npm_package_version;
  if (projectVersion === undefined) {
    const ErrorMessage = "Project version is undefined.";
    console.error(ErrorMessage);
    throw ErrorMessage;
  }
  const segmentSize = 1 * 1024 ** 3; // 1GB
  const fileName = `${projectName}-${projectVersion}-x64.nsis.7z`; // target file name
  const targetDirectory = target.outDir; // for nsis-web
  const outputDirectory = path.resolve(targetDirectory, "out");
  const inputFile = path.resolve(targetDirectory, fileName);

  console.log("Splitting NSIS Archive...");
  const inputStream = fs.createReadStream(inputFile, {
    encoding: null,
    highWaterMark: segmentSize,
  });

  let fileIndex = 0;
  const sizes = [];
  const hashes = [];
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
        encoding: null,
      });

      outputStream.write(chunk);
      outputStream.end();

      fileIndex += 1;
      sizes.push(chunk.length);
      const hash = crypto.createHash('md5');
      hashes.push(hash.update(chunk).digest('hex'));
    });
  });

  inputStream.on("end", () => {
    const iniFilePath = path.resolve(outputDirectory, fileName).concat(".ini");
    fs.writeFileSync(iniFilePath, createIni(sizes, hashes));
    console.log("Finished NSIS Archive split.");
  });
};
