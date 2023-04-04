/** @type {import('@typescript-eslint/utils').TSESLint.Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    "plugin:vue/vue3-essential",
    "eslint:recommended",
    "@vue/typescript/recommended",
    "@vue/prettier",
    "@vue/eslint-config-typescript",
    "@vue/eslint-config-prettier",
  ],
  plugins: ["import"],
  parser: "vue-eslint-parser",
  parserOptions: {
    ecmaVersion: 2020,
    parser: "@typescript-eslint/parser",
  },
  ignorePatterns: ["dist_electron/**/*", "dist/**/*", "node_modules/**/*"],
  rules: {
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
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["electron"],
            message:
              "electronに依存する型はelectronで動作するコード内にのみ含みます",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: [
        "./src/background.ts",
        "./src/background/*.ts",
        "./src/electron/*.ts",
      ],
      rules: {
        "no-console": "off",
      },
    },
    {
      files: [
        "./src/background.ts",
        "./src/background/*.ts",
        "./src/electron/*.ts",
      ],
      rules: {
        "no-restricted-imports": "off",
      },
    },
  ],
};
