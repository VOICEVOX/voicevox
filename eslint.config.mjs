// @ts-check
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import globals from "globals";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore 型の定義が無い
import importPlugin from "eslint-plugin-import";
import prettierConfigRecommended from "eslint-plugin-prettier/recommended";
import vueConfigRecommended from "eslint-plugin-vue/lib/configs/flat/vue3-recommended.js";
import vueParser from "vue-eslint-parser";
import {
  config as defineConfig,
  configs,
  parser as typescriptParser,
} from "typescript-eslint";

const compat = new FlatCompat();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @overload
 * @param {string} name
 * @param {import("eslint").Linter.Config} config
 * @returns {import("@typescript-eslint/utils/ts-eslint").FlatConfig.Config[]}
 */
/**
 * @overload
 * @param {import("eslint").Linter.Config[]} configs
 * @returns {import("@typescript-eslint/utils/ts-eslint").FlatConfig.Config[]}
 */
/**
 * @param {string | import("eslint").Linter.Config[]} nameOrConfigs
 * @param {import("eslint").Linter.Config} config
 * @returns {import("@typescript-eslint/utils/ts-eslint").FlatConfig.Config[]}
 */
const pluginConfig = (nameOrConfigs, config) => {
  if (typeof nameOrConfigs === "string") {
    return /** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.Config[]} */ ([
      { name: nameOrConfigs, ...config },
    ]);
  } else {
    return /** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.Config[]} */ (
      nameOrConfigs
    );
  }
};

/**
 * FlatCompatのextends()\
 * ESLint Config Inspector用
 * @param {string} configToExtend
 * @returns {import("@typescript-eslint/utils/ts-eslint").FlatConfig.Config[]}
 */
const compatExtend = (configToExtend) => {
  const flatConfigs = compat.extends(configToExtend);

  if (process.env.ESLINT_INSPECTOR) {
    flatConfigs.forEach((config, i) => {
      // filesがあるとESLint Config Inspectorがエラーを吐くので削除
      delete config.files;

      // ESLint Config Inspectorで見やすいように名前を付ける
      config.name = `FlatCompat/${configToExtend}[${i}]`;
    });
  }

  return /** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.Config[]} */ (
    flatConfigs
  );
};

/** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.ParserOptions} */
const vueParserOptions = {
  ecmaVersion: 2020,
  parser: typescriptParser,
};

/** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.ParserOptions} */
const typeCheckedParserOptions = {
  project: ["./tsconfig.json"],
  tsconfigRootDir: __dirname,
};

/** @type {import("@typescript-eslint/utils/ts-eslint").FlatConfig.Rules} */
const typeCheckedRules = {
  // Storeでよくasyncなしの関数を定義するので無効化
  // TODO: いずれは有効化する
  "@typescript-eslint/require-await": "off",

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

export default defineConfig(
  {
    name: "voicevox/defaults/plugins",
    plugins: {
      import: importPlugin,
    },
  },

  {
    name: "voicevox/defaults/linterOptions",
    linterOptions: {
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

  {
    name: "voicevox/defaults/ignores",
    ignores: ["dist_electron/**/*", "dist/**/*", "node_modules/**/*"],
  },

  ...pluginConfig(vueConfigRecommended),
  ...pluginConfig("eslint:recommended", js.configs.recommended),
  ...compatExtend("@vue/prettier"),
  ...compatExtend("@vue/typescript/recommended"),
  ...pluginConfig("prettier:recommended", prettierConfigRecommended),
  ...compatExtend("plugin:@voicevox/all"),
  // ...compatExtends("plugin:storybook/recommended"),

  {
    name: "voicevox/type-checked/typescript",
    files: ["*/**/*.ts"],
    extends: [...configs.recommendedTypeChecked],
    languageOptions: {
      parser: typescriptParser,
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
    extends: [...configs.recommendedTypeChecked],
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
    files: [
      "*.config.*",
      "src/**/*.{js,ts,vue}",
      "tests/**/*.{js,ts,vue}",
      "build/**/*.{js,ts,vue}",
      ".storybook/**/*.{js,ts,vue}",
    ],
  },

  {
    name: "voicevox/defaults/rules",
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": [
        process.env.NODE_ENV !== "production" ? "warn" : "error", // 開発時のみwarn
        {
          ignoreRestSiblings: true,
        },
      ],
      "import/order": "error",
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
      "vue/component-name-in-template-casing": [
        "error",
        "PascalCase",
        {
          registeredComponentsOnly: false,
          ignores: [],
        },
      ],
      "vue/component-tags-order": [
        "error",
        {
          order: ["template", "script", "style"],
        },
      ],
      "vue/multi-word-component-names": [
        "error",
        {
          ignores: ["Container", "Presentation"],
        },
      ],
      "vue/no-restricted-syntax": [
        "error",
        {
          selector: "LogicalExpression[operator=??]",
          message: `template内で"??"を使うとgithubのsyntax highlightが崩れるので\n三項演算子等を使って書き換えてください`,
        },
        {
          selector: "MemberExpression[optional=true]",
          message: `template内で"?."を使うとgithubのsyntax highlightが崩れるので\n三項演算子等を使って書き換えてください`,
        },
      ],
      "vue/v-bind-style": [
        "error",
        "shorthand",
        { sameNameShorthand: "always" },
      ],
      "vue/v-on-event-hyphenation": ["error", "never", { autofix: true }],
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
              group: ["electron"],
              message:
                "このファイル内でelectronはimportできません。許可されているファイル内へ移すか、ESLintの設定を見直してください",
            },
          ],
        },
      ],
    },
  },
);
