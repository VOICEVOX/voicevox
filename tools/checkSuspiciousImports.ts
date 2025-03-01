/**
 * 与えられたjsファイルのimport/requireを解析し、以下の条件に当てはまらないものがあれば警告を出力する：
 * - Node.js 標準である
 * - electron
 * - try-catch内での明示的に許可されたパッケージ
 *
 * また、try-catch内での明示的に許可されたパッケージが使われていない場合も警告を出力する。
 *
 * pnpm run check-suspicious-imports ./path/to/file.js のように単体でも実行可能。
 *
 * NOTE:
 * electron-builderはpnpmを一緒に使うとnode_modulesが壊れる問題があるが、
 * それはビルド後（dist/{main.js,preload.js}）でパッケージがimport/requireされなければ問題ないため、
 * このスクリプトを使って問題がないかチェックする。
 * ref: https://github.com/VOICEVOX/voicevox/issues/2508
 */

import { builtinModules } from "module";
import { styleText } from "util";
import fs from "fs/promises";
import yargs from "yargs";
import { parse } from "acorn";
import { ancestor as visitWithAncestor } from "acorn-walk";
import { hideBin } from "yargs/helpers";

const defaultAllowedModules = [
  ...builtinModules.map((m) => `node:${m}`),
  "electron",
];

type Import = {
  path: string;
  isInsideTryCatch: boolean;
};
export type CheckSuspiciousImportsOptions = {
  allowedModules?: string[];
  allowedInTryCatchModules?: string[];
  list?: boolean;
};
export function checkSuspiciousImports(
  file: string,
  jsContent: string,
  options: CheckSuspiciousImportsOptions = {},
): void {
  console.log(`Checking suspicious imports in ${file}...`);
  const ast = parse(jsContent, {
    ecmaVersion: "latest",
    sourceType: "module",
  });

  const allImports: Import[] = [];

  const allowedModules = [
    ...defaultAllowedModules,
    ...(options.allowedModules ?? []),
  ];
  const allowedInTryCatchModules = options.allowedInTryCatchModules ?? [];

  visitWithAncestor(ast, {
    ImportDeclaration(node) {
      const importPath = node.source.value;
      if (typeof importPath === "string") {
        allImports.push({
          path: importPath,
          isInsideTryCatch: false,
        });
      }
    },
    CallExpression(node, _, ancestors) {
      const isInsideTryCatch = ancestors.some(
        (ancestor) => ancestor.type === "TryStatement",
      );
      if (node.callee.type === "Identifier" && node.callee.name === "require") {
        const importPath =
          node.arguments[0].type === "Literal" && node.arguments[0].value;
        if (typeof importPath === "string") {
          allImports.push({
            path: importPath,
            isInsideTryCatch,
          });
        }
      }
    },
  });

  const normalizedImports: Import[] = [];
  for (const importInfo of allImports) {
    let path = importInfo.path;
    if (builtinModules.includes(path) && !path.startsWith("node:")) {
      path = `node:${path}`;
    }
    const existingImport = normalizedImports.find((i) => i.path === path);
    if (existingImport) {
      existingImport.isInsideTryCatch &&= importInfo.isInsideTryCatch;
    } else {
      normalizedImports.push({
        ...importInfo,
        path,
      });
    }
  }

  const allowedImports = normalizedImports.filter((i) =>
    allowedModules.includes(i.path),
  );
  const allowedInTryCatchImports = normalizedImports.filter(
    (i) =>
      !allowedModules.includes(i.path) &&
      allowedInTryCatchModules.includes(i.path),
  );
  const suspiciousImports = normalizedImports.filter(
    (i) =>
      !allowedModules.includes(i.path) &&
      !allowedInTryCatchModules.includes(i.path),
  );

  for (const [color, title, imports] of [
    ["green", "Allowed", allowedImports],
    ["yellow", "Allowed in try-catch", allowedInTryCatchImports],
    ["red", "Suspicious", suspiciousImports],
  ] as const) {
    if (options.list) {
      console.log(styleText(color, `  ${title}:`));
      for (const i of imports) {
        console.log(styleText(color, `    ${i.path}`));
      }
      if (imports.length === 0) {
        console.log(styleText(color, `    (none)`));
      }
    } else {
      console.log(styleText(color, `  ${title}: ${imports.length}`));
    }
  }

  if (suspiciousImports.length > 0) {
    throw new Error(
      `Suspicious imports found: ${suspiciousImports
        .map((i) => i.path)
        .join(", ")}`,
    );
  }

  const unusedAllowedInTryCatchModules = allowedInTryCatchModules.filter(
    (m) => !allowedInTryCatchImports.some((i) => i.path === m),
  );
  if (options.list) {
    console.log(styleText("yellow", `  Unused allowed in try-catch modules:`));
    for (const m of unusedAllowedInTryCatchModules) {
      console.log(styleText("yellow", `    ${m}`));
    }
    if (unusedAllowedInTryCatchModules.length === 0) {
      console.log(styleText("yellow", `    (none)`));
    }
  } else {
    console.log(
      styleText(
        "yellow",
        `  Unused allowed in try-catch modules: ${unusedAllowedInTryCatchModules.length}`,
      ),
    );
  }
  if (unusedAllowedInTryCatchModules.length > 0) {
    throw new Error(
      `Some allowed in try-catch modules are not used in try-catch block: ${unusedAllowedInTryCatchModules.join(
        ", ",
      )}`,
    );
  }
}

if (import.meta.filename === process.argv[1]) {
  const parser = yargs(hideBin(process.argv))
    .option("allowed-modules", {
      type: "string",
      array: true,
      description: "Allowed modules",
      alias: "a",
    })
    .option("allowed-in-try-catch-modules", {
      type: "string",
      array: true,
      description: "Allowed in try-catch modules",
      alias: "t",
    })
    .positional("files", {
      type: "string",
      description: "Files to check",
      array: true,
    })
    .strictCommands()
    .demandCommand(1);
  const args = await parser.parse();

  for (const rawFile of args._) {
    const file = rawFile.toString();
    fs.readFile(file, "utf-8")
      .then((content) => {
        checkSuspiciousImports(file, content, {
          allowedModules: args.allowedModules,
          allowedInTryCatchModules: args.allowedInTryCatchModules,
          list: true,
        });
      })
      .catch((e) => {
        console.error(e);
        process.exit(1);
      });
  }
}
