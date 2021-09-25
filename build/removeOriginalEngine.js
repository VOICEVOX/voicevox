/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");

const ORIGINAL_ENGINE_DIR_TO_REMOVE = process.env.ORIGINAL_ENGINE_DIR_TO_REMOVE;

// target: electron-builder.Target
exports.default = async function (target) {
  fs.rmdirSync(ORIGINAL_ENGINE_DIR_TO_REMOVE, { recursive: true });
};
