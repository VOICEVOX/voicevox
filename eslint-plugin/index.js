// @ts-check
/* eslint-disable @typescript-eslint/no-require-imports */
module.exports = {
  configs: {
    all: {
      plugins: ["@voicevox"],
      rules: {
        "@voicevox/no-strict-nullable": "error",
      },
    },
  },
  rules: {
    "no-strict-nullable": require("./no-strict-nullable"),
  },
};
