import { Patch } from "immer";
import { ExhaustiveError } from "@/type/utility";

/**
 * produceWithPatchesにより生成された複数のパッチをオブジェクトに適用する。
 *
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

// 値を再帰的に複製する。
// ユーザー定義クラスのインスタンスや関数など、複製しない値で例外を発生させる。
function clone<T>(value: T): T {
  // function等、単純にcloneできない値の取り扱いを禁止する
  if (!isObject(value)) return structuredClone(value);

  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype)
      throw new Error("unsupported type");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value.map((v) => clone(v)) as T;
  }

  if (value instanceof Map) {
    if (Object.getPrototypeOf(value) !== Map.prototype)
      throw new Error("unsupported type");
    const result = new Map();
    for (const [k, v] of value.entries()) {
      result.set(clone(k), clone(v));
    }
    return result as T;
  }

  if (value instanceof Set) {
    if (Object.getPrototypeOf(value) !== Set.prototype)
      throw new Error("unsupported type");
    const result = new Set();
    for (const v of value.values()) {
      result.add(clone(v));
    }
    return result as T;
  }

  // object以外の自前classは現状利用していないため不具合予防として一旦禁止
  // 適切な動作テストの後制限を緩めることを妨げるものではない
  if (Object.getPrototypeOf(value) !== Object.prototype)
    throw new Error("unsupported type");

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
  const result: any = Object.create(Object.getPrototypeOf(value));
  for (const [k, v] of Object.entries(value)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
  } else if (Array.isArray(value)) {
    if (typeof key === "number") {
      value.splice(key, 0, v);
    } else if (key === "-") {
      value.push(v);
    } else {
      throw new Error("unsupported key");
    }
  } else {
    // @ts-expect-error produceWithPatchesにより生成されたPatchを適用するため、valueはany型として扱う
    value[key] = v;
  }
}

function replace(value: unknown, key: string | number, v: unknown): void {
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
  } else if (Array.isArray(value) && typeof key === "number") {
    value.splice(key, 1);
  } else {
    // @ts-expect-error produceWithPatchesにより生成されたPatchを適用するため、valueはany型として扱う
    delete value[key];
  }
}

/**
 * produceWithPatchesにより生成された単一のパッチをオブジェクトに適用する。
 *
 * @param {T} target パッチを適用する対象オブジェクト
 * @param {Patch} patch 適用するパッチ
 * @template T 対象オブジェクトの型(任意)
 */
function applyPatch<T>(target: T, patch: Patch) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { path, value, op } = patch;
  for (const p of patch.path.slice(0, path.length - 1)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    target = get(target, p);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const v = clone(value);
  switch (op) {
    case "add":
      add(target, path[path.length - 1], v);
      break;
    case "replace":
      replace(target, path[path.length - 1], v);
      break;
    case "remove":
      remove(target, path[path.length - 1], v);
      break;
    default:
      throw new ExhaustiveError(op);
  }
}
