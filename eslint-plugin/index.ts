import type { FlatConfig } from "@typescript-eslint/utils/ts-eslint";
import noStrictNullable from "./no-strict-nullable";
import noUselessNonNullAssertion from "./no-useless-non-null-assertion";
import pkg from "./package.json" with { type: "json" };

const rules: FlatConfig.Plugin["rules"] = {
  "no-strict-nullable": noStrictNullable,
  "no-useless-non-null-assertion": noUselessNonNullAssertion,
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
    allTyped: [
      {
        name: "@voicevox/all-typed",
        plugins: {
          "@voicevox": plugin,
        },
        rules: {
          "@voicevox/no-strict-nullable": "error",
          "@voicevox/no-useless-non-null-assertion": "error",
        },
      },
    ],
  },
} satisfies FlatConfig.Plugin;

export default voicevoxPlugin;
