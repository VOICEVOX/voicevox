/* eslint-disable @typescript-eslint/no-var-requires */
const splitNsisArchive = require("./splitNsisArchive").default;

// target: electron-builder.Target
exports.default = async function (target) {
  await splitNsisArchive(target);
};
