export function createLog(scope: string) {
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
