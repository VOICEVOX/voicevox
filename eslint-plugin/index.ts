import { FlatConfig } from "@typescript-eslint/utils/ts-eslint";
import noStrictNullable from "./no-strict-nullable";
import pkg from "./package.json" with { type: "json" };

const rules: FlatConfig.Plugin["rules"] = {
  "no-strict-nullable": noStrictNullable,
};

const plugin: FlatConfig.Plugin = {
  meta: { name: pkg.name, version: pkg.version },
  rules,
};

type VoicevoxPlugin = {
  configs: {
    all: FlatConfig.ConfigArray;
  };
};

const voicevoxPlugin: VoicevoxPlugin = {
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
