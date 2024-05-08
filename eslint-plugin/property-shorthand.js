const utils = require("eslint-plugin-vue/lib/utils");
const { createRule } = require("./create-rule");

/** @typedef {import("vue-eslint-parser").AST} AST */

module.exports = createRule({
  create(context) {
    return utils.defineTemplateBodyVisitor(
      context,
      // Event handlers for <template>.
      {
        VAttribute(node) {
          if (!node.directive) return;
          if (node.key.type !== "VDirectiveKey") return;
          if (node.key.argument?.type !== "VIdentifier") return;
          if (node.value?.type !== "VExpressionContainer") return;
          if (node.value.expression?.type !== "Identifier") return;
          if (node.key.argument.rawName !== node.value.expression.name) return;
          // shorthand property is handled as overrapped distinct nodes
          if (rangesEqual(node.key.argument.range, node.value.expression.range))
            return;

          context.report({
            node: node,
            messageId: "report",
            data: {
              ident: node.key.argument.rawName,
            },
            fix(fixer) {
              return fixer.removeRange([
                node.key.range[1],
                node.value.range[1],
              ]);
            },
          });
        },
      },
    );
  },
  name: "property-shorthand",
  meta: {
    type: "problem",
    docs: {
      description: "プロパティのショートハンド記法が使える場合に必ず使う",
      recommended: "error",
    },
    messages: {
      report:
        "':{{ ident }}=\"{{ ident }}\"'ではなく':{{ ident }}'を使用してください。",
    },
    schema: [],
    fixable: "code",
  },
  defaultOptions: [],
});

/**
 * @param {readonly [number, number]} a
 * @param {readonly [number, number]} b
 */
function rangesEqual(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}
