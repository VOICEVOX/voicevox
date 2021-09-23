/* eslint-disable @typescript-eslint/no-var-requires */
const splitResources = require("./splitResources").default;

// target: electron-builder.Target
exports.default = async function (target) {
  splitResources(target);
};
