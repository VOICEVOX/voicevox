// @ts-check
import { ESLintUtils } from "@typescript-eslint/utils";

export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/VOICEVOX/voicevox/blob/main/eslint-plugin/${name}.md`,
);
