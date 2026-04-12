import ts from "typescript";
import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "./create-rule";

export default createRule({
  name: "no-useless-non-null-assertion",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow calling assertNonNullable or ensureNotNullish on values that cannot be null or undefined.",
    },
    schema: [],
    messages: {
      unnecessary:
        "この値は型に null / undefined を含まないため、{{ functionName }} を呼び出す必要はありません。",
    },
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();

    function includesNullish(type: ts.Type): boolean {
      const parts = type.isUnion() ? type.types : [type];
      return parts.some(
        (t) =>
          (t.flags & ts.TypeFlags.Null) !== 0 ||
          (t.flags & ts.TypeFlags.Undefined) !== 0,
      );
    }

    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (
          node.callee.type !== TSESTree.AST_NODE_TYPES.Identifier ||
          (node.callee.name !== "assertNonNullable" &&
            node.callee.name !== "ensureNotNullish")
        ) {
          return;
        }

        const arg = node.arguments[0];
        if (!arg) return;

        const tsNode = services.esTreeNodeToTSNodeMap.get(arg);
        const type = checker.getTypeAtLocation(tsNode);

        if (!includesNullish(type)) {
          context.report({
            node: arg,
            messageId: "unnecessary",
          });
        }
      },
    };
  },
});
