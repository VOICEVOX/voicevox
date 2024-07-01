/** @type {import('@typescript-eslint/utils').TSESLint.Linter.Config} */
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
  parser: "vue-eslint-parser",
  parserOptions: {
    ecmaVersion: 2020,
    parser: "@typescript-eslint/parser",
  },
  ignorePatterns: ["dist_electron/**/*", "dist/**/*", "node_modules/**/*"],
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
