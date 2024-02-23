import { WatchOptions, WatchSource, watch } from "vue";

/**
 * trueが返されたらunwatchするwatch
 */
const onetimeWatch = <T>(
  source: WatchSource<T>,
  fn: (before: T, after: T | undefined) => Promise<boolean> | boolean,
  options: WatchOptions = {}
) => {
  const unwatch = watch(
    source,
    async (after, before) => {
      if (await fn(after, before)) {
        unwatch();
      }
    },
    options
  );
};

export default onetimeWatch;
