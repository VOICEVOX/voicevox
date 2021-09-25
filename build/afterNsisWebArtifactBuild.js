/* eslint-disable @typescript-eslint/no-var-requires */
const splitNsisArchive = require("./splitNsisArchive").default;
const removeOriginalEngine = require("./removeOriginalEngine").default;

const process = require("process");
const REMOVE_ORIGINAL_ENGINE = process.env.ORIGINAL_ENGINE_DIR_TO_REMOVE !== "";

// target: electron-builder.Target
exports.default = async function (target) {
  if (REMOVE_ORIGINAL_ENGINE) {
    await removeOriginalEngine(target);
  }

  await splitNsisArchive(target);
};
