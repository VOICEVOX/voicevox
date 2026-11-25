import * as fs from "node:fs";
import * as path from "node:path";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "./create-rule";

const SRC_DIR = path.resolve(import.meta.dirname, "..", "src");

const RESOLVE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".vue",
  ".json",
];

// .vue / .json は拡張子を省略できないため、取り除く対象から外す
const STRIPPABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

function isFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function resolveTarget(basePath: string): string | undefined {
  if (isFile(basePath)) return basePath;

  for (const extension of RESOLVE_EXTENSIONS) {
    const candidate = `${basePath}${extension}`;
    if (isFile(candidate)) return candidate;
  }

  for (const extension of RESOLVE_EXTENSIONS) {
    const candidate = path.join(basePath, `index${extension}`);
    if (isFile(candidate)) return candidate;
  }

  return undefined;
}

function toPosix(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function stripScriptExtension(filePath: string): string {
  const extension = path.extname(filePath);
  return STRIPPABLE_EXTENSIONS.has(extension)
    ? filePath.slice(0, -extension.length)
    : filePath;
}

function stripIndexSuffix(modulePath: string): string {
  return modulePath.endsWith("/index")
    ? modulePath.slice(0, -"/index".length)
    : modulePath;
}

function isInside(filePath: string, directory: string): boolean {
  const relative = path.relative(directory, filePath);
  return (
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  );
}

/** src 直下のディレクトリ名。src 直下のファイルなら undefined。 */
function topLevelDirectory(filePath: string): string | undefined {
  const relative = path.relative(SRC_DIR, filePath);
  if (
    relative === "" ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    return undefined;
  }

  const [first, ...rest] = relative.split(path.sep);
  return rest.length > 0 ? first : undefined;
}

function isSameDirectory(a: string, b: string): boolean {
  return path.dirname(a) === path.dirname(b);
}

function toRelativeSpecifier(fromFile: string, targetFile: string): string {
  const relative = stripIndexSuffix(
    stripScriptExtension(
      toPosix(path.relative(path.dirname(fromFile), targetFile)),
    ),
  );
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function toAbsoluteSpecifier(targetFile: string): string {
  const relative = stripIndexSuffix(
    stripScriptExtension(toPosix(path.relative(SRC_DIR, targetFile))),
  );
  return `@/${relative}`;
}

export default createRule({
  name: "consistent-import-path",
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "Enforce relative imports within the same top-level directory under src, and @/ absolute imports otherwise.",
    },
    schema: [],
    messages: {
      unify: 'インポートパスは "{{expected}}" にしてください。',
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename;
    if (!isInside(filename, SRC_DIR)) return {};

    const currentTopLevel = topLevelDirectory(filename);

    function checkSource(source: TSESTree.Node | null | undefined): void {
      if (
        source?.type !== AST_NODE_TYPES.Literal ||
        typeof source.value !== "string"
      ) {
        return;
      }

      const specifier = source.value;
      let basePath: string;
      if (specifier.startsWith("@/")) {
        basePath = path.join(SRC_DIR, specifier.slice("@/".length));
      } else if (specifier.startsWith(".")) {
        basePath = path.resolve(path.dirname(filename), specifier);
      } else {
        return;
      }

      const targetFile = resolveTarget(basePath);
      if (targetFile == null || !isInside(targetFile, SRC_DIR)) return;

      const sameTopLevel =
        currentTopLevel != null &&
        currentTopLevel === topLevelDirectory(targetFile);

      const expected =
        isSameDirectory(filename, targetFile) || sameTopLevel
          ? toRelativeSpecifier(filename, targetFile)
          : toAbsoluteSpecifier(targetFile);

      if (expected === specifier) return;

      const quote = source.raw.startsWith("'") ? "'" : '"';
      context.report({
        node: source,
        messageId: "unify",
        data: { expected },
        fix: (fixer) =>
          fixer.replaceText(source, `${quote}${expected}${quote}`),
      });
    }

    return {
      ImportDeclaration(node) {
        checkSource(node.source);
      },
      ExportNamedDeclaration(node) {
        checkSource(node.source);
      },
      ExportAllDeclaration(node) {
        checkSource(node.source);
      },
      ImportExpression(node) {
        checkSource(node.source);
      },
    };
  },
});
