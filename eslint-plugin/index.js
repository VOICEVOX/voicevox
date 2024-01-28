// @ts-check
module.exports = {
  configs: {
    all: {
      plugins: ["@voicevox"],
      rules: {
        "@voicevox/no-strict-nullable": "error",
        "@voicevox/no-json-stringify-parse": "error",
      },
    },
  },
  rules: {
    "no-strict-nullable": require("./no-strict-nullable"),
    "no-json-stringify-parse": require("./no-json-stringify-parse"),
  },
};
