/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");

exports.default = async function (buildResult) {
  const projectVersion = process.env.npm_package_version;
  if (projectVersion === undefined) {
    const ErrorMessage = "Project version is undefined.";
    console.error(ErrorMessage);
    throw ErrorMessage;
  }
  const segmentSize = 1 * 1024 ** 3; // 1GB
  const fileName = `voicevox-${projectVersion}-x64.nsis.7z`; // target file name
  const targetDirectory = path.resolve(buildResult.outDir, "nsis-web"); // for nsis-web
  const outputDirectory = path.resolve(targetDirectory, "out");
  const inputFile = path.resolve(targetDirectory, fileName);

  console.log("Split file.");
  const inputStream = fs.createReadStream(inputFile, {
    encoding: null,
    highWaterMark: segmentSize,
  });

  let fileIndex = 0;
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
    });
  });

  inputStream.on("end", () => {
    console.log("Finished.");
  });
};
