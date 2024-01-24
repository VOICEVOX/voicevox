const { ESLintUtils } = require("@typescript-eslint/utils");

exports.createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/VOICEVOX/voicevox/blob/main/rules/${name}.md`
);
