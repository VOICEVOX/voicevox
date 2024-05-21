import { watch, ref, WatchSource, UnwrapRef } from "vue";

/**
 * 非同期なcomputed。
 */
export const asyncComputed = <T, U>(
  source: WatchSource<U>,
  defaultValue: T,
  fn: (newValue: U, oldValue: U | undefined) => Promise<T>,
) => {
  const result = ref<T>(defaultValue);

  watch(
    source,
    async (newValue: U, oldValue: U | undefined) => {
      result.value = (await fn(newValue, oldValue)) as UnwrapRef<T>;
    },
    {
      immediate: true,
    },
  );

  return result;
};
