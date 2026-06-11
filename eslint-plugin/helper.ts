import type { TSESLint } from "@typescript-eslint/utils";

/**
 * Vueテンプレート内でもESLintルールを適用するためのヘルパー関数。
 * vue-eslint-parserが提供するdefineTemplateBodyVisitorを利用する。
 * 非Vueファイルでは通常のリスナーをそのまま返す。
 */
export function wrapListenerForVueTemplate(
  context: TSESLint.RuleContext<string, unknown[]>,
  listener: TSESLint.RuleListener,
): TSESLint.RuleListener {
  const parserServices = context.sourceCode.parserServices as
    | {
        defineTemplateBodyVisitor?: (
          templateBodyVisitor: TSESLint.RuleListener,
          scriptVisitor: TSESLint.RuleListener,
        ) => TSESLint.RuleListener;
      }
    | undefined;

  if (parserServices?.defineTemplateBodyVisitor != undefined) {
    return parserServices.defineTemplateBodyVisitor(listener, listener);
  }

  return listener;
}
