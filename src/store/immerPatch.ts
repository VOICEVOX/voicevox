import { Patch } from "immer";
import { ExhaustiveError } from "@/type/utility";

/**
 * produceWithPatchesにより生成された複数のパッチをオブジェクトに適用します。
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {};
  for (const [k, v] of Object.entries(value)) {
    result[k] = clone(v);
  }
  return result as T;
}

/**
 * produceWithPatchesにより生成された単一のパッチをオブジェクトに適用します。
 *
 * @param {T} target パッチを適用する対象オブジェクト
 * @param {Patch} patch 適用するパッチ
 * @template T 対象オブジェクトの型(任意)
 */
export function applyPatch<T>(target: T, patch: Patch) {
  const { path, value, op } = patch;
  for (const p of patch.path.slice(0, path.length - 1)) {
    // @ts-expect-error produceWithPatchesにより生成されたPatchを適用するため、targetはany型として扱う
    target = target[p];
  }
  const v = clone(value);
  switch (op) {
    case "add":
    case "replace":
      // @ts-expect-error produceWithPatchesにより生成されたPatchを適用するため、targetはany型として扱う
      target[path[path.length - 1]] = v;
      break;
    case "remove":
      // @ts-expect-error produceWithPatchesにより生成されたPatchを適用するため、targetはany型として扱う
      delete target[path[path.length - 1]];
      break;
    default:
      throw new ExhaustiveError(op);
  }
}
