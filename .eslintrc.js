const vueEslintParser = "vue-eslint-parser";
const vueEslintParserOptions = {
  ecmaVersion: 2020,
  parser: "@typescript-eslint/parser",
};
const tsEslintOptions = {
  project: ["./tsconfig.json"],
  tsconfigRootDir: __dirname,
};

const tsEslintRules = {
  // Storeでよくasyncなしの関数を定義するので無効化
  // TODO: いずれは有効化する
  "@typescript-eslint/require-await": "off",

  // 比較関数無しでのsortは文字列での比較になり、ミスが起こりやすいため有効化
  "@typescript-eslint/require-array-sort-compare": "error",

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

/** @type {import('@typescript-eslint/utils').TSESLint.Linter.ConfigType} */
module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    "plugin:vue/vue3-recommended",
    "eslint:recommended",
    "@vue/typescript/recommended",
    "@vue/prettier",
    "@vue/eslint-config-typescript/recommended",
    "@vue/eslint-config-prettier",
    "plugin:@voicevox/all",
    "plugin:storybook/recommended",
  ],
  plugins: ["import"],
  parser: vueEslintParser,
  parserOptions: vueEslintParserOptions,
  ignorePatterns: ["dist/**/*", "dist_*/**/*", "node_modules/**/*"],
  rules: {
    "linebreak-style":
      process.env.NODE_ENV === "production" && process.platform !== "win32"
        ? ["error", "unix"]
        : "off",
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-constant-condition": ["error", { checkLoops: false }], // while(true) などを許可
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    "prettier/prettier": [
      "error",
      {
        endOfLine: "auto",
      },
    ],
    "@typescript-eslint/no-unused-vars": [
      process.env.NODE_ENV === "development" ? "warn" : "error", // 開発時のみwarn
      {
        ignoreRestSiblings: true,
      },
    ],
    "vue/attribute-hyphenation": ["error", "never"],
    "vue/v-on-event-hyphenation": ["error", "never", { autofix: true }],
    "vue/v-bind-style": ["error", "shorthand", { sameNameShorthand: "always" }],
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
    "import/order": "error",
  },
  overrides: [
    {
      files: [
        "./src/backend/electron/**/*.ts",
        "./tests/**/*.ts",
        "./build/*.js",
        "./build/*.mts",
      ],
      rules: {
        "no-console": "off",
      },
    },
    {
      files: ["*.ts", "*.mts"],
      parser: "@typescript-eslint/parser",
      extends: ["plugin:@typescript-eslint/recommended-type-checked"],
      parserOptions: tsEslintOptions,
      rules: tsEslintRules,
    },
    {
      files: ["*.vue"],
      parser: vueEslintParser,
      parserOptions: { ...vueEslintParserOptions, ...tsEslintOptions },
      extends: ["plugin:@typescript-eslint/recommended-type-checked"],
      rules: {
        ...tsEslintRules,

        // typescript-eslintにVueの型がanyとして認識されるので無効化
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/no-redundant-type-constituents": "off",
      },
    },
    // Electronのメインプロセス以外でelectronのimportを禁止する
    {
      files: ["./src/**/*.ts", "./src/**/*.vue"],
      excludedFiles: ["./src/backend/electron/**/*.ts"],
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
  ],
};
