import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import { createRule } from "./create-rule";
import { wrapListenerForVueTemplate } from "./helper";

type RestrictedMethodName = "dispatch" | "commit";

function getRestrictedMethodName(
  node: TSESTree.MemberExpression,
): RestrictedMethodName | undefined {
  if (
    node.computed === false &&
    node.property.type === AST_NODE_TYPES.Identifier
  ) {
    if (node.property.name === "dispatch" || node.property.name === "commit") {
      return node.property.name;
    }
    return undefined;
  }

  if (
    node.computed === true &&
    node.property.type === AST_NODE_TYPES.Literal &&
    (node.property.value === "dispatch" || node.property.value === "commit")
  ) {
    return node.property.value;
  }

  return undefined;
}

export default createRule({
  create(context) {
    return wrapListenerForVueTemplate(context, {
      CallExpression(node) {
        if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return;

        const methodName = getRestrictedMethodName(node.callee);
        if (methodName == undefined) return;

        context.report({
          node: node.callee.property,
          messageId: methodName,
        });
      },
    });
  },
  name: "no-vuex-dispatch-commit",
  meta: {
    type: "problem",
    docs: {
      description: "Vuexのdispatchとcommitを使わない",
    },
    messages: {
      dispatch:
        "Vuexのdispatchは使用しないでください。`store.actions.ACTION名()`を使ってください",
      commit:
        "Vuexのcommitは使用しないでください。`store.mutations.MUTATION名()`を使ってください",
    },
    schema: [],
  },
  defaultOptions: [],
});
