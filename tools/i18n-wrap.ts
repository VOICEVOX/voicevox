/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from "node:fs";
import path from "node:path";
import { parse as parseSfc } from "@vue/compiler-sfc";
import { parse as parseTs } from "@typescript-eslint/parser";

const JA = /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/;

const WRAP_ATTRS = new Set([
  "title",
  "description",
  "label",
  "aria-label",
  "placeholder",
]);

const WRAP_PROPS = new Set([
  "title",
  "description",
  "message",
  "actionName",
  "ok",
]);

const TARGET_LOCALES = ["en", "zh-CN"];

type Edit = { start: number; end: number; text: string };

function singleQuote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/**
 * compiler-sfc のバージョンによって、loc.offset が
 * - SFC 全体の絶対 offset
 * - template content からの相対 offset
 * のどちらかになるため、実際の文字列と突き合わせて判定する。
 */
function offsetOf(loc: any, base: number, source: string): number {
  const start = loc.start.offset;
  const text = loc.source;

  if (source.slice(start, start + text.length) === text) {
    return start;
  }

  const shifted = base + start;
  if (source.slice(shifted, shifted + text.length) === text) {
    return shifted;
  }

  throw new Error(
    `cannot resolve offset for: ${JSON.stringify(text.slice(0, 60))}`,
  );
}

function walkTemplate(
  node: any,
  base: number,
  source: string,
  edits: Edit[],
  keys: Set<string>,
): void {
  if (node == null || typeof node !== "object") return;

  // TextNode
  if (node.type === 2 && typeof node.content === "string") {
    const span = node.loc.source;
    if (JA.test(span)) {
      const text = span.trim();
      if (text !== "") {
        const start = offsetOf(node.loc, base, source);
        const end = start + span.length;

        if (source.slice(start, end) !== span) {
          throw new Error(`text mismatch: ${JSON.stringify(span)}`);
        }

        const leading = span.match(/^\s*/)?.[0]?.length ?? 0;
        const trailing = span.match(/\s*$/)?.[0]?.length ?? 0;

        keys.add(text);
        edits.push({
          start: start + leading,
          end: end - trailing,
          text: `{{ $t(${JSON.stringify(text)}) }}`,
        });
      }
    }
  }


  // ElementNode の静的属性
  if (node.type === 1) {
    for (const prop of node.props ?? []) {
      if (
        prop.type === 6 &&
        WRAP_ATTRS.has(prop.name) &&
        typeof prop.value?.content === "string" &&
        JA.test(prop.value.content)
      ) {
        const start = offsetOf(prop.loc, base, source);
        const end = start + prop.loc.source.length;

        if (source.slice(start, end) !== prop.loc.source) {
          throw new Error(`attribute mismatch: ${prop.loc.source}`);
        }

        const value = prop.value.content;
        keys.add(value);
        edits.push({
          start,
          end,
          text: `:${prop.name}="$t(${singleQuote(value)})"`,
        });
      }
    }
  }

  for (const child of node.children ?? []) {
    walkTemplate(child, base, source, edits, keys);
  }
}

function walkScript(
  node: any,
  base: number,
  edits: Edit[],
  keys: Set<string>,
): void {
  if (node == null || typeof node !== "object") return;

  if (
    node.type === "Property" &&
    node.value?.type === "Literal" &&
    typeof node.value.value === "string" &&
    node.value.range != null
  ) {
    const keyName =
      node.key?.type === "Identifier" ? node.key.name : node.key?.value;

    if (WRAP_PROPS.has(keyName) && JA.test(node.value.value)) {
      keys.add(node.value.value);
      edits.push({
        start: base + node.value.range[0],
        end: base + node.value.range[1],
        text: `t(${JSON.stringify(node.value.value)})`,
      });
    }
  }

  for (const key of Object.keys(node)) {
    if (key === "parent") continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) walkScript(item, base, edits, keys);
    } else if (child != null && typeof child === "object") {
      walkScript(child, base, edits, keys);
    }
  }
}

function updateLocaleFiles(keys: Set<string>): void {
  const files = [
    "src/i18n/locales/ja.json",
    ...TARGET_LOCALES.map((locale) => `src/i18n/locales/${locale}.json`),
  ];

  for (const file of files) {
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

      // ja は identity、それ以外は日文原文を仮置き
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
  const source = fs.readFileSync(file, "utf8");
  const { descriptor } = parseSfc(source, { filename: file });

  const edits: Edit[] = [];
  const keys = new Set<string>();

  if (descriptor.template?.ast) {
    walkTemplate(
      descriptor.template.ast,
      descriptor.template.loc.start.offset,
      source,
      edits,
      keys,
    );
  }

  const script = descriptor.scriptSetup ?? descriptor.script;
  if (script != null) {
    const ast = parseTs(script.content, {
      range: true,
      loc: true,
      sourceType: "module",
      ecmaVersion: "latest",
    });
    walkScript(ast, script.loc.start.offset, edits, keys);
  }

  edits.sort((a, b) => b.start - a.start);

  let output = source;
  for (const edit of edits) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }

  console.log(`${file}: ${edits.length} replacements, ${keys.size} keys`);

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
  console.error("usage: pnpm tsx tools/i18n-wrap.ts <file.vue> [--write]");
  process.exit(1);
}

for (const file of files) {
  processFile(path.resolve(file), write);
}

function readLocale(file: string): Record<string, string> | undefined {
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string>;
}
