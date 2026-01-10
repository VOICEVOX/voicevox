import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "./create-rule";
import { wrapListenerForVueTemplate } from "./helper";

function isNull(node: TSESTree.Expression) {
  return node.type === AST_NODE_TYPES.Literal && node.value == null;
}

function isUndefined(node: TSESTree.Expression) {
  return node.type === AST_NODE_TYPES.Identifier && node.name === "undefined";
}

const noStrictNullable = createRule({
  create(context) {
    return wrapListenerForVueTemplate(context, {
      BinaryExpression(node) {
        if (node.operator !== "===" && node.operator !== "!==") return;
        if (!isNull(node.right) && !isUndefined(node.right)) return;

        context.report({
          node,
          messageId: "report",
          data: {
            operator: node.operator.slice(0, 2),
            expression: context.sourceCode.getText(node.right),
          },
          fix(fixer) {
            return fixer.replaceTextRange(
              [node.left.range[1], node.right.range[0]],
              node.operator.slice(0, 2) + " ",
            );
          },
        });
      },
    });
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
