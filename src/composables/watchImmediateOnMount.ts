import { WatchOptions, WatchSource, onMounted, ref, watch } from "vue";

/**
 * 通常のwatchの実行タイミングに加え、mounted時にも実行されるwatch。
 * DOMの操作を行う場合、watchのimmediateオプションの代わりにこちらを使う。
 *
 * NOTE: 通常のwatchのimmediateオプションはmounted前のcreated時に実行される。
 * DOMの操作はmounted後に行う必要があるため、通常のwatchのimmediateオプションは使えない。
 */
const watchImmediateOnMount = <T>(
  source: WatchSource<T>,
  fn: (object: T) => void, // beforeは使えない
  options: WatchOptions = {}
) => {
  const isMounted = ref(false);
  onMounted(() => {
    isMounted.value = true;
  });

  watch(
    [isMounted, source],
    async ([mounted, object]) => {
      if (!mounted) return;
      fn(object);
    },
    options
  );
};

export default watchImmediateOnMount;
