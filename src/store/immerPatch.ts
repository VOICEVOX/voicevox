import { Patch } from "immer";
import { enablePatches as enablePatchesImpl } from "immer/src/plugins/patches";
import { enableMapSet as enableMapSetImpl } from "immer/src/plugins/mapset";
import { getPlugin } from "immer/src/utils/plugins";

enablePatchesImpl();
enableMapSetImpl();
const applyPatchesImpl = getPlugin("Patches").applyPatches_;

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
  applyPatchesImpl(target, [patch]);
}
