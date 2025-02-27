/* eslint-disable @typescript-eslint/no-require-imports */
const splitNsisArchive = require("./splitNsisArchive").default;

// target: electron-builder.Target
exports.default = async function (target) {
  await splitNsisArchive(target);
};
