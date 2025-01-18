import { ComputedRef } from "vue";
import type { InjectionKey } from "vue";

export const gridInfoInjectionKey: InjectionKey<{
  gridCellWidth: ComputedRef<number>;
  gridCellHeight: ComputedRef<number>;
  gridWidth: ComputedRef<number>;
  gridHeight: ComputedRef<number>;
}> = Symbol();
