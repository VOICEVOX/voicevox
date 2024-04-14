/** ログ出力用の関数を生成する。ブラウザ専用。 */
// TODO: window.backendをDIできるようにする
export function createLogger(scope: string) {
  const createInner =
    (method: "logInfo" | "logError" | "logWarn") =>
    (message: string, ...args: unknown[]) => {
      window.backend[method](`[${scope}] ${message}`, ...args);
    };
  return {
    info: createInner("logInfo"),
    error: createInner("logError"),
    warn: createInner("logWarn"),
  };
}
