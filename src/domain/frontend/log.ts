/** ログ出力用の関数を生成する。ブラウザ専用。 */
// TODO: window.backendをDIできるようにする
export function createLogger(scope: string) {
  const createInner =
    (method: "logInfo" | "logError" | "logWarn") =>
    (...args: unknown[]) => {
      window.backend[method](`[${scope}] ${args[0]}`, ...args.slice(1));
    };
  return {
    info: createInner("logInfo"),
    error: createInner("logError"),
    warn: createInner("logWarn"),
  };
}
