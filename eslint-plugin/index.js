// @ts-check
module.exports = {
  configs: {
    all: {
      plugins: ["@voicevox"],
      rules: {
        "@voicevox/no-strict-nullable": "error",
        "@voicevox/property-shorthand": "error",
      },
    },
  },
  rules: {
    "no-strict-nullable": require("./no-strict-nullable"),
    "property-shorthand": require("./property-shorthand"),
  },
};
