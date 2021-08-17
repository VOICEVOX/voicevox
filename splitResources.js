// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");

exports.default = async function (buildResult) {
  const segmentSize = 1 * 1024 ** 3; // 1GB
  const fileName = "voicevox-0.3.1-x64.nsis.7z"; // targe file name
  const targetDirectory = path.resolve(buildResult.outDir, "nsis-web"); // for nsis-web
  const outputDirectory = path.resolve(targetDirectory, "out");
  const inputFile = path.resolve(targetDirectory, fileName);

  console.log("Split file.");
  const inputStream = fs.createReadStream(inputFile, {
    encoding: null,
    highWaterMark: segmentSize,
  });

  let file_index = 0;
  inputStream.on("data", (chunk) => {
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
        .concat(".", file_index.toString());
      const outputStream = fs.createWriteStream(outputFilePath, {
        flags: "w+",
        encoding: null,
      });

      outputStream.write(chunk);
      outputStream.end();

      file_index += 1;
    });
  });

  inputStream.on("end", () => {
    console.log("Finished.");
  });
};
