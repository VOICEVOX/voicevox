import type { FlatConfig } from "@typescript-eslint/utils/ts-eslint";
import noStrictNullable from "./no-strict-nullable";
import pkg from "./package.json" with { type: "json" };

const rules: FlatConfig.Plugin["rules"] = {
  "no-strict-nullable": noStrictNullable,
};

const plugin: FlatConfig.Plugin = {
  meta: { name: pkg.name, version: pkg.version },
  rules,
};

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
} satisfies FlatConfig.Plugin;

export default voicevoxPlugin;
