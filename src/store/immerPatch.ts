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

function assert(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message);
  }
}

// cloneした値がclone前と等しいことを確認する
// この関数内で落ちる場合、clone関数及びapplyPatchがサポートしていない値を利用している可能性がある
function assert_equals(a: unknown, b: unknown) {
  if (a === b) return;
  assert(isObject(a) === isObject(b), "type mismatch");
  if (!isObject(a) || !isObject(b)) return;
  assert(
    Object.getPrototypeOf(a) === Object.getPrototypeOf(b),
    "prototype mismatch",
  );
  if (Array.isArray(a)) {
    assert(Array.isArray(b), "type mismatch");
    assert(a.length === b.length, "array length mismatch");
    for (let i = 0; i < a.length; i++) {
      assert_equals(a[i], b[i]);
    }
    return;
  }

  if (a instanceof Map) {
    assert(b instanceof Map, "type mismatch");
    assert(a.size === b.size, "Map size mismatch");
    for (const [key, value] of a) {
      assert(b.has(key), "missing key");
      assert_equals(value, b.get(key));
    }
    return;
  }

  if (a instanceof Set) {
    assert(b instanceof Set, "type mismatch");
    assert(a.size === b.size, "Set size mismatch");
    for (const value of a) {
      assert(b.has(value), "missing value");
    }
    return;
  }

  assert(
    Object.entries(a).length === Object.entries(b).length,
    "Object length mismatch",
  );

  // b_anyのように明示的にanyを経由しない場合、assertが期待通りにはたらかない
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b_any = b as any;
  for (const [key, value] of Object.entries(a)) {
    assert(key in b_any, "missing key");
    assert_equals(value, b_any[key]);
  }
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
  assert_equals(value, v);
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
