/** ログ出力用の関数を生成する。ブラウザ専用。 */
// TODO: window.backendをDIできるようにする
export function createLogger(scope: string) {
  const createInner =
    (
      method: "logInfo" | "logError" | "logWarn",
      fallbackMethod: "info" | "warn" | "error",
    ) =>
    (...args: unknown[]) => {
      if (window.backend == undefined) {
        console[fallbackMethod](...args);
        return;
      }
      window.backend[method](`[${scope}]`, ...args);
    };
  return {
    info: createInner("logInfo", "info"),
    error: createInner("logError", "warn"),
    warn: createInner("logWarn", "error"),
  };
}
