/** ログ出力用の関数を生成する。ブラウザ専用。 */
// TODO: window.backendをDIできるようにする
export function createLogger(scope: string) {
  return {
    info: createLogFunction("info"),
    warn: createLogFunction("warn"),
    error: createLogFunction("error"),
  };

  function createLogFunction(logType: "info" | "warn" | "error") {
    return (...args: unknown[]) => {
      if (window.backend != undefined) {
        const method = (
          {
            info: "logInfo",
            warn: "logWarn",
            error: "logError",
          } as const
        )[logType];
        window.backend[method](`[${scope}]`, ...args);
        return;
      }

      // eslint-disable-next-line no-console
      console[logType](...args);
    };
  }
}
