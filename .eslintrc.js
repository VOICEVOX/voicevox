const vueEslintParserParams = {
  parser: "vue-eslint-parser",
  parserOptions: {
    ecmaVersion: 2022,
    parser: "@typescript-eslint/parser",
  },
};

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
  ],
  plugins: ["import"],
  parser: vueEslintParserParams.parser,
  parserOptions: {
    ...vueEslintParserParams.parserOptions,
  },
  ignorePatterns: ["dist_electron/**/*", "dist/**/*", "node_modules/**/*"],
  rules: {
    "linebreak-style":
      process.env.NODE_ENV === "production" && process.platform !== "win32"
        ? ["error", "unix"]
        : "off",
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
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
      "warn",
      {
        ignoreRestSiblings: true,
      },
    ],
    "vue/component-tags-order": [
      "error",
      {
        order: ["template", "script", "style"],
      },
    ],
    "import/order": "error",
  },
  overrides: [
    {
      // consoleの使用禁止、代わりにloggerを使う
      files: [
        "./src/background.ts",
        "./src/background/*.ts",
        "./src/electron/*.ts",
        "./tests/**/*.ts",
        "./build/*.js",
        "./build/*.mts",
      ],
      rules: {
        "no-console": "off",
      },
    },
    {
      // Electronのメインプロセス以外でelectronのimportを禁止する
      files: ["./src/**/*.ts", "./src/**/*.vue"],
      excludedFiles: [
        "./src/background.ts",
        "./src/background/*.ts",
        "./src/electron/*.ts",
      ],
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
    {
      // TypeScript系のみの設定
      files: ["*.ts", "*.tsx", "*.vue"],
      extends: [
        "plugin:@typescript-eslint/recommended-requiring-type-checking", // Vue用がまだ無いため
      ],
      parser: vueEslintParserParams.parser,
      parserOptions: {
        ...vueEslintParserParams.parserOptions,
        project: "tsconfig.json",
      },
    },
  ],
};
