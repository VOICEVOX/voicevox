import { type Logger } from "electron-log";
import { isElectron, isNode } from "@/helpers/platform";

type LogLevel = "info" | "warn" | "error";
type LogFunction = (...args: unknown[]) => void;

let electronLogPromise: Promise<Logger> | undefined = undefined;

/**
 * ログ出力用の関数を生成する。
 * ブラウザ環境・Electron環境・Node.js環境で動作する。
 */
export function createLogger(scope: string): Record<LogLevel, LogFunction> {
  return {
    info: createLogFunction("info"),
    warn: createLogFunction("warn"),
    error: createLogFunction("error"),
  };

  function createLogFunction(logType: LogLevel): LogFunction {
    return (...args: unknown[]) => {
      const scopeAndArgs = [`[${scope}]`, ...args];

      // フロントエンドの場合
      if (typeof window != "undefined" && window.backend != undefined) {
        const method = (
          { info: "logInfo", warn: "logWarn", error: "logError" } as const
        )[logType];
        window.backend[method](...scopeAndArgs);
        return;
      }

      // Electronのメインプロセスの場合
      if (isNode && isElectron) {
        if (electronLogPromise == undefined) {
          electronLogPromise = import("electron-log/main");
        }

        void electronLogPromise.then((log) => {
          log[logType](...scopeAndArgs);
        });
        return;
      }

      // eslint-disable-next-line no-console
      console[logType](...scopeAndArgs);
    };
  }
}
