import type { Logger } from "electron-log";
import { isElectron, isNode } from "@/helpers/platform";
import { UnreachableError } from "@/type/utility";

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
      // テスト環境の場合
      if (import.meta.env.MODE === "test") {
        // eslint-disable-next-line no-console
        console[logType](...scopeAndArgs);
        return;
      }

      // フロントエンドの場合
      if (typeof window != "undefined") {
        if (window.backend != undefined) {
          const method = (
            { info: "logInfo", warn: "logWarn", error: "logError" } as const
          )[logType];
          window.backend[method](...scopeAndArgs);
          return;
        } else if (window.welcomeBackend != undefined) {
          const method = (
            { info: "logInfo", warn: "logWarn", error: "logError" } as const
          )[logType];
          window.welcomeBackend[method](...scopeAndArgs);
          return;
        }

        // Storybookなどの環境では、window.backendやwindow.welcomeBackendが存在しないため、通常のconsoleを使用する
        // eslint-disable-next-line no-console
        console[logType](...scopeAndArgs);
        return;
      }

      // Electronのメインプロセスの場合
      if (isNode && isElectron) {
        if (electronLogPromise == undefined) {
          // NOTE: electron-log/mainをインポートするとViteによって警告が出るため、electron-logをインポートする
          electronLogPromise = import("electron-log");
        }

        void electronLogPromise.then((log) => {
          log[logType](...scopeAndArgs);
        });

        // eslint-disable-next-line no-console
        console[logType](...scopeAndArgs);
        return;
      }

      throw new UnreachableError();
    };
  }
}
