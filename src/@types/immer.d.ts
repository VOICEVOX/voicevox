// immerの内部APIの型定義。exportsで指定されていないファイルを参照するために用意したもの。
declare module "immer/src/plugins/patches" {
  export function enablePatches(): void;
}
declare module "immer/src/plugins/mapset" {
  export function enableMapSet(): void;
}
declare module "immer/src/utils/plugins" {
  import { Patch } from "immer";
  export function getPlugin(name: "Patches"): {
    applyPatches_: (state: unknown, patches: Patch[]) => void;
  };
}
