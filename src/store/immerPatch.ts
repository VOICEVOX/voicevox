import { Patch } from "immer";
import { ExhaustiveError } from "@/type/utility";

/**
 * produceWithPatchesにより生成された複数のパッチをオブジェクトに適用します。
 * 実装の都合により、patches[i].valueが独自classを含む場合は正常に動作しない可能性があります。
 * @param {T} target パッチを適用する対象オブジェクト
 * @param {Patch[]} patches 適用するパッチの配列
 * @template T 対象オブジェクトの型(任意)
 */
export function applyPatches<T>(target: T, patches: Patch[]) {
  for (const patch of patches) {
    applyPatch(target, patch);
  }
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value != null;
}

// structuredCloneはfunction等を処理できないため、適当なフォールバックを用意する
function clone<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    // これ以下の処理へのフォールバックが目的なので何もしない
  }
  if (!isObject(value)) return value;
  if (Array.isArray(value)) {
    return value.map((v) => clone(v)) as T;
  }

  if (value instanceof Map) {
    const result = new Map();
    for (const [k, v] of value.entries()) {
      result.set(clone(k), clone(v));
    }
    return result as T;
  }

  if (value instanceof Set) {
    const result = new Set();
    for (const v of value.values()) {
      result.add(clone(v));
    }
    return result as T;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {};
  for (const [k, v] of Object.entries(value)) {
    result[k] = clone(v);
  }
  return result as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function get(value: unknown, key: string | number): any {
  if (value instanceof Map) {
    return value.get(key);
  }
  // @ts-expect-error produceWithPatchesにより生成されたPatchを適用するため、valueはany型として扱う
  return value[key];
}

function add(value: unknown, key: string | number, v: unknown): void {
  if (value instanceof Map) {
    value.set(key, v);
  } else if (value instanceof Set) {
    value.add(v);
  } else {
    // @ts-expect-error produceWithPatchesにより生成されたPatchを適用するため、valueはany型として扱う
    value[key] = v;
  }
}

function remove(value: unknown, key: string | number, v: unknown): void {
  if (value instanceof Map) {
    value.delete(key);
  } else if (value instanceof Set) {
    value.delete(v);
  } else {
    // @ts-expect-error produceWithPatchesにより生成されたPatchを適用するため、valueはany型として扱う
    delete value[key];
  }
}

/**
 * produceWithPatchesにより生成された単一のパッチをオブジェクトに適用します。
 * 実装の都合により、patch.valueが独自classを含む場合は正常に動作しない可能性があります。
 * @param {T} target パッチを適用する対象オブジェクト
 * @param {Patch} patch 適用するパッチ
 * @template T 対象オブジェクトの型(任意)
 */
export function applyPatch<T>(target: T, patch: Patch) {
  const { path, value, op } = patch;
  for (const p of patch.path.slice(0, path.length - 1)) {
    target = get(target, p);
  }
  const v = clone(value);
  switch (op) {
    case "add":
    case "replace":
      add(target, path[path.length - 1], v);
      break;
    case "remove":
      remove(target, path[path.length - 1], v);
      break;
    default:
      throw new ExhaustiveError(op);
  }
}
