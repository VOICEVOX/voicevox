// @ts-check
const { AST_NODE_TYPES } = require("@typescript-eslint/utils");
const { createRule } = require("./create-rule");

/**
 * @param {import("@typescript-eslint/types").TSESTree.BinaryExpression["left"]} node
 */
function isNull(node) {
  return node.type === AST_NODE_TYPES.Literal && node.value == null;
}

/**
 * @param {import("@typescript-eslint/types").TSESTree.BinaryExpression["right"]} node
 */
function isUndefined(node) {
  return node.type === AST_NODE_TYPES.Identifier && node.name === "undefined";
}

module.exports = createRule({
  create(context) {
    return {
      BinaryExpression(node) {
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
              node.operator.slice(0, 2) + " "
            );
          },
        });
      },
    };
  },
  name: "no-strict-nullable",
  meta: {
    type: "problem",
    docs: {
      description: "undefinedとnullと比較する際に厳密等価演算子を使わない",
      recommended: "error",
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
