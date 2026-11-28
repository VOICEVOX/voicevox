/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const JA = /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/;

const WRAP_PROPS = new Set([
  "label",
  "title",
  "description",
  "message",
  "actionName",
  "ok",
]);

// 言語名など、翻訳したくない値
const SKIP_VALUES = new Set([
  "日本語",
  "English",
  "简体中文",
  "中文",
  "英語",
  "中国語",
]);

const IMPORT_LINE = 'import { translate } from "@/i18n/translate";';

type Edit = { start: number; end: number; text: string };

function collect(
  node: ts.Node,
  source: ts.SourceFile,
  edits: Edit[],
  keys: Set<string>,
): void {
  if (ts.isPropertyAssignment(node)) {
    const name = node.name;
    const propName =
      ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
    const init = node.initializer;

    if (
      propName != null &&
      WRAP_PROPS.has(propName) &&
      ts.isStringLiteral(init) &&
      JA.test(init.text) &&
      !SKIP_VALUES.has(init.text)
    ) {
      keys.add(init.text);
      edits.push({
        start: init.getStart(source),
        end: init.getEnd(),
        text: `translate(${JSON.stringify(init.text)})`,
      });
    }
  }

  ts.forEachChild(node, (child) => collect(child, source, edits, keys));
}

function updateLocaleFiles(keys: Set<string>): void {
  for (const locale of ["ja", "en", "zh-CN"]) {
    const file = `src/i18n/locales/${locale}.json`;
    if (!fs.existsSync(file)) {
      console.warn(`skip: ${file} not found`);
      continue;
    }

    const json = JSON.parse(fs.readFileSync(file, "utf8")) as Record<
      string,
      string
    >;
    let added = 0;

    for (const key of keys) {
      if (key in json) continue;
      if (key.includes("|")) {
        console.warn(`skip unsafe key: ${JSON.stringify(key)}`);
        continue;
      }
      json[key] = key;
      added++;
    }

    if (added > 0) {
      fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
    }
    console.log(`${file}: +${added} keys`);
  }
}

function processFile(file: string, write: boolean): void {
  const sourceText = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const edits: Edit[] = [];
  const keys = new Set<string>();

  collect(source, source, edits, keys);

  if (edits.length === 0) {
    console.log(`${file}: 0 replacements`);
    return;
  }

  // import がなければ追加
  if (!/from\s+["']@\/i18n\/translate["']/.test(sourceText)) {
    const imports = source.statements.filter(ts.isImportDeclaration);
    const pos = imports.length ? imports[imports.length - 1].getEnd() : 0;
    edits.push({ start: pos, end: pos, text: `\n${IMPORT_LINE}` });
  }

  edits.sort((a, b) => b.start - a.start);

  let output = sourceText;
  for (const edit of edits) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }

  console.log(`${file}: ${edits.length} edits, ${keys.size} keys`);

  if (!write) {
    console.log("dry-run: add --write to apply");
    return;
  }

  fs.writeFileSync(file, output);
  updateLocaleFiles(keys);
}

const args = process.argv.slice(2);
const write = args.includes("--write");
const files = args.filter((arg) => !arg.startsWith("--"));

if (files.length === 0) {
  console.error("usage: pnpm tsx tools/i18n-wrap-ts.ts <file.ts> [--write]");
  process.exit(1);
}

for (const file of files) {
  processFile(path.resolve(file), write);
}
