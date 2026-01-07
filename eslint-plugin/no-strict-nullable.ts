import { AST_NODE_TYPES, TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "./create-rule";

function isNull(node: TSESTree.Expression) {
  return node.type === AST_NODE_TYPES.Literal && node.value == null;
}

function isUndefined(node: TSESTree.Expression) {
  return node.type === AST_NODE_TYPES.Identifier && node.name === "undefined";
}

const noStrictNullable = createRule({
  create(context) {
    const checkBinaryExpression = (node: TSESTree.BinaryExpression) => {
      if (node.operator !== "===" && node.operator !== "!==") return;
      if (!isNull(node.right) && !isUndefined(node.right)) return;

      context.report({
        node,
        messageId: "report",
        data: {
          operator: node.operator.slice(0, 2),
          expression: context.getSourceCode().getText(node.right),
        },
        fix(fixer) {
          return fixer.replaceTextRange(
            [node.left.range[1], node.right.range[0]],
            node.operator.slice(0, 2) + " ",
          );
        },
      });
    };

    const listener: TSESLint.RuleListener = {
      BinaryExpression: checkBinaryExpression,
    };

    const parserServices = context.parserServices as {
      defineTemplateBodyVisitor?: (
        templateBodyVisitor: TSESLint.RuleListener,
        scriptBodyVisitor?: TSESLint.RuleListener,
      ) => TSESLint.RuleListener;
    };

    if (parserServices.defineTemplateBodyVisitor) {
      return parserServices.defineTemplateBodyVisitor(listener, listener);
    }

    return listener;
  },
  name: "no-strict-nullable",
  meta: {
    type: "problem",
    docs: {
      description: "undefinedとnullと比較する際に厳密等価演算子を使わない",
    },
    messages: {
      report:
        "'{{ operator }}= {{ expression }}'ではなく'{{ operator }} {{ expression }}'を使用してください。",
    },
    schema: [],
    fixable: "code",
  },
  defaultOptions: [],
});

export default noStrictNullable;
