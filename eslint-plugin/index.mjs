// @ts-check
import { createRequire } from "node:module";
import noStrictNullable from "./no-strict-nullable.mjs";

const require = createRequire(import.meta.url);
const { name, version } = require("./package.json");

/** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.Plugin["rules"]} */
const rules = {
  "no-strict-nullable": noStrictNullable,
};

/** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.Plugin} */
const plugin = {
  meta: { name, version },
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
