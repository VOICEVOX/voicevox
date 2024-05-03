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
    target = target[p];
  }
  const v = structuredClone(value);
  switch (op) {
    case "add":
    case "replace":
      target[path[path.length - 1]] = v;
      break;
    case "remove":
      delete target[path[path.length - 1]];
      break;
    default:
      throw new ExhaustiveError(op);
  }
}
