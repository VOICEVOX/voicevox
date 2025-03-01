/* eslint-disable @typescript-eslint/no-require-imports */
const splitNsisArchive = require("./splitNsisArchive.cjs").default;

// target: electron-builder.Target
module.exports.default = async function (target) {
  await splitNsisArchive(target);
};
