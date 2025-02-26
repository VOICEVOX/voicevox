// @ts-check
import noStrictNullable from "./no-strict-nullable.mjs";
import pkg from "./package.json" with { type: "json" };

/** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.Plugin["rules"]} */
const rules = {
  "no-strict-nullable": noStrictNullable,
};

/** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.Plugin} */
const plugin = {
  meta: { name: pkg.name, version: pkg.version },
  rules,
};

/** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.Plugin} */
const voicevoxPlugin = {
  configs: {
    all: [
      {
        name: "@voicevox/all",
        plugins: {
          "@voicevox": plugin,
        },
        rules: {
          "@voicevox/no-strict-nullable": "error",
        },
      },
    ],
  },
};

export default voicevoxPlugin;
