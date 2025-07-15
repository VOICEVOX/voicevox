import js from "@eslint/js";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import storybookPlugin from "eslint-plugin-storybook";
import vueParser from "vue-eslint-parser";
import vuePlugin from "eslint-plugin-vue";
import vuePrettierConfig from "@vue/eslint-config-prettier";
import {
  defineConfigWithVueTs,
  vueTsConfigs,
} from "@vue/eslint-config-typescript";
import { configs as tsConfigs, parser as tsParser } from "typescript-eslint";
import type { FlatConfig } from "@typescript-eslint/utils/ts-eslint";
import progressPlugin from "eslint-plugin-file-progress";
import gitignoreConfig from "eslint-config-flat-gitignore";
import vitestPlugin from "@vitest/eslint-plugin";
import voicevoxPlugin from "./eslint-plugin";

type Config = FlatConfig.Config;
type ConfigArray = FlatConfig.ConfigArray;
type ParserOptions = FlatConfig.ParserOptions;
type Rules = FlatConfig.Rules;

/**
 * プラグイン読込ラッパー関数
 * nameが設定されていないプラグイン用
 */
function pluginConfig(name: string, config: Config): ConfigArray;
/**
 * プラグイン読込ラッパー関数
 * nameが設定されている or Arrayを渡すプラグイン用
 */
function pluginConfig(configs: Config | ConfigArray): ConfigArray;
function pluginConfig(
  nameOrConfigs: string | Config | ConfigArray,
  config?: Config,
): ConfigArray {
  if (typeof nameOrConfigs === "string") {
    return [{ name: nameOrConfigs, ...config }];
  } else if (Array.isArray(nameOrConfigs)) {
    return nameOrConfigs;
  } else {
    return [nameOrConfigs];
  }
}

const vueParserOptions: ParserOptions = {
  ecmaVersion: 2020,
  parser: tsParser,
  extraFileExtensions: [".vue"],
};

const typeCheckedParserOptions: ParserOptions = {
  project: ["./tsconfig.json"],
  tsconfigRootDir: import.meta.dirname,
};

const typeCheckedRules: Rules = {
  // Storeでよくasyncなしの関数を定義するので無効化
  // TODO: いずれは有効化する
  "@typescript-eslint/require-await": "off",

  // 比較関数無しでのsortは文字列での比較になり、ミスが起こりやすいため有効化
  "@typescript-eslint/require-array-sort-compare": "error",

  "@typescript-eslint/no-non-null-assertion": "error",

  "@typescript-eslint/no-misused-promises": [
    "error",
    {
      // (...) => voidに(...) => Promise<void>を渡すのは許可
      // ただし特に強い意志でこれを許可しているわけではないので、
      // もし問題が発生した場合は有効化する
      // ref: https://canary.discord.com/channels/879570910208733277/893889888208977960/1267467454876225536
      checksVoidReturn: false,
    },
  ],
};

export default defineConfigWithVueTs(
  {
    name: "voicevox/defaults/plugins",
    plugins: {
      import: importPlugin,
      progress: progressPlugin,
    },
  },

  {
    name: "voicevox/defaults/linterOptions",
    linterOptions: {
      // TODO: いずれは有効化する
      reportUnusedDisableDirectives: false,
    },
  },

  {
    name: "voicevox/defaults/languageOptions",
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ...vueParserOptions,
      },
      globals: {
        ...globals.node,
      },
    },
  },

  gitignoreConfig(),

  ...pluginConfig(vuePlugin.configs["flat/recommended"]),
  ...pluginConfig("eslint:recommended", js.configs.recommended),
  ...pluginConfig("@vue/prettier", vuePrettierConfig),
  ...pluginConfig(vueTsConfigs.recommended.toConfigArray()),
  ...pluginConfig(voicevoxPlugin.configs.all),
  ...pluginConfig(storybookPlugin.configs["flat/recommended"]),
  ...pluginConfig(vitestPlugin.configs.recommended),

  {
    name: "voicevox/type-checked/typescript",
    files: ["**/*.ts", "**/*.mts"],
    extends: [...tsConfigs.recommendedTypeChecked],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ...typeCheckedParserOptions,
      },
    },
    rules: {
      ...typeCheckedRules,
    },
  },

  {
    name: "voicevox/type-checked/vue",
    files: ["**/*.vue"],
    extends: [...tsConfigs.recommendedTypeChecked],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ...vueParserOptions,
        ...typeCheckedParserOptions,
      },
    },
    rules: {
      ...typeCheckedRules,

      // typescript-eslintにVueの型がanyとして認識されるので無効化
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
    },
  },

  {
    name: "voicevox/defaults/files",
    files: ["**/*.{js,mjs,ts,mts,vue}"],
  },

  {
    name: "voicevox/defaults/rules",
    rules: {
      "@typescript-eslint/no-unused-vars": [
        process.env.NODE_ENV !== "production" ? "warn" : "error", // 開発時のみwarn
        {
          ignoreRestSiblings: true,
        },
      ],
      "import/order": "error",
      "import/enforce-node-protocol-usage": ["error", "always"],
      "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
      "no-constant-condition": ["error", { checkLoops: false }], // while(true) などを許可
      "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
      "prettier/prettier": [
        "error",
        {
          endOfLine: "auto",
        },
      ],
      "vue/attribute-hyphenation": ["error", "never"],
      "vue/block-order": [
        "error",
        {
          order: ["template", "script", "style"],
        },
      ],
      "vue/component-name-in-template-casing": [
        "error",
        "PascalCase",
        {
          registeredComponentsOnly: false,
          ignores: [],
        },
      ],
      "vue/multi-word-component-names": [
        "error",
        {
          ignores: ["Container", "Presentation"],
        },
      ],
      "vue/v-bind-style": [
        "error",
        "shorthand",
        { sameNameShorthand: "always" },
      ],
      "vue/v-on-event-hyphenation": ["error", "never", { autofix: true }],
      "progress/activate":
        process.env.ESLINT_FILE_PROGRESS === "1" ? "error" : "off",
      "vitest/expect-expect": ["error", { assertFunctionNames: ["expect*"] }],
    },
  },

  {
    name: "voicevox/some-allow-console",
    files: [
      "src/backend/electron/**/*.ts",
      "tests/**/*.ts",
      "build/*.{js,mts}",
    ],
    rules: {
      "no-console": "off",
    },
  },

  // Electronのメインプロセス以外でelectronのimportを禁止する
  {
    name: "voicevox/restricted-electron-imports-outside-main-process",
    ignores: ["src/backend/electron/**/*.ts"],
    files: ["src/**/*.{ts,vue}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^electron(\\/|$)",
              message:
                "このファイル内でelectronはimportできません。許可されているファイル内へ移すか、ESLintの設定を見直してください",
            },
          ],
        },
      ],
    },
  },
);
