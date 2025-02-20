// @ts-check
const { AST_NODE_TYPES } = require("@typescript-eslint/types");
const { createRule } = require("./create-rule");

/**
 * @typedef {import("@typescript-eslint/types").TSESTree.Expression} Expression
 * @typedef {import("@typescript-eslint/types").TSESTree.PrivateIdentifier} PrivateIdentifier
 */

/**
 * @param {Expression | PrivateIdentifier} node
 * @param {string} name
 * @returns {node is import("@typescript-eslint/types").TSESTree.Identifier}
 */
function isIdentifier(node, name) {
  return node.type === "Identifier" && node.name === name;
}

/**
 * @param {Expression | PrivateIdentifier} node
 * @param {string} object
 * @param {string} property
 * @returns {node is import("@typescript-eslint/types").TSESTree.MemberExpression}
 */
function isMemberExpression(node, object, property) {
  return (
    node.type === "MemberExpression" &&
    isIdentifier(node.object, object) &&
    isIdentifier(node.property, property)
  );
}

module.exports = createRule({
  create(context) {
    return {
      CallExpression(node) {
        if (!isMemberExpression(node.callee, "JSON", "parse")) return;
        if (node.arguments.length !== 1) return;
        const arg1 = node.arguments[0];
        if (
          arg1.type !== "CallExpression" ||
          !isMemberExpression(arg1.callee, "JSON", "stringify")
        )
          return;
        if (arg1.arguments.length !== 1) return;
        const arg2 = arg1.arguments[0];

        context.report({
          node,
          messageId: "report",
          data: {
            inner: context.getSourceCode().getText(arg2),
          },
          fix(fixer) {
            const fixes = [
              fixer.replaceText(node.callee, "structuredClone"),
              fixer.replaceText(arg1.callee, "toRaw"),
            ];

            if (node.parent?.type === AST_NODE_TYPES.TSAsExpression) {
              fixes.push(
                fixer.removeRange([node.range[1], node.parent.range[1]])
              );
            }

            if (node.parent?.type === AST_NODE_TYPES.VariableDeclarator) {
              const annotation = node.parent.id.typeAnnotation;
              if (annotation) {
                fixes.push(fixer.remove(annotation));
              }
            }

            return fixes;
          },
        });
      },
    };
  },
  name: "no-json-stringify-parse",
  meta: {
    type: "problem",
    docs: {
      description: "JSON.parse(JSON.stringify(hoge))を使わない",
      recommended: "error",
    },
    messages: {
      report:
        "'JSON.stringify(JSON.parse({{ inner }}))'ではなく'structuredClone(toRaw({{ inner }}))'を使用してください。",
    },
    schema: [],
    fixable: "code",
  },
  defaultOptions: [],
});
