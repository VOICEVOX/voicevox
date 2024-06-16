import { WatchOptions, WatchSource, watch } from "vue";

/**
 * trueが返されたらunwatchするwatch
 */
const onetimeWatch = <T>(
  source: WatchSource<T>,
  fn: (
    before: T,
    after: T | undefined,
  ) => Promise<"unwatch" | "continue"> | "unwatch" | "continue",
  options: WatchOptions = {},
) => {
  const unwatch = watch(
    source,
    async (after, before) => {
      if ((await fn(after, before)) === "unwatch") {
        unwatch();
      }
    },
    options,
  );
};

export default onetimeWatch;
