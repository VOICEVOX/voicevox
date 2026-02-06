/**
 * ElectronのpreloadプロセスとMainWorldプロセスの橋渡し。
 */

// TODO: backend/electron/renderer/backendApiLoader.tsと共通化する

import { welcomeSandboxKey, type WelcomeSandbox } from "../preloadType";
import { getOrThrowTransferableResult } from "@/backend/electron/transferableResultHelper";
import type { TransferableResult } from "@/backend/electron/transferableResultHelper";

export const welcomeBridgeKey = "welcomeElectronBridge";

export type WelcomeSandboxWithTransferableResult = {
  [K in keyof WelcomeSandbox]: (
    ...args: Parameters<WelcomeSandbox[K]>
  ) => ReturnType<WelcomeSandbox[K]> extends Promise<infer R>
    ? Promise<TransferableResult<R>>
    : TransferableResult<ReturnType<WelcomeSandbox[K]>>;
};

const unwrapApi = (
  baseApi: WelcomeSandboxWithTransferableResult,
): WelcomeSandbox =>
  new Proxy<WelcomeSandbox>({} as WelcomeSandbox, {
    get(_target, prop: keyof WelcomeSandboxWithTransferableResult) {
      const value = baseApi[prop];
      if (typeof value !== "function") {
        return value;
      }

      return (
        ...args: Parameters<WelcomeSandboxWithTransferableResult[typeof prop]>
      ) => {
        const result: ReturnType<
          WelcomeSandboxWithTransferableResult[typeof prop]
        > =
          // @ts-expect-error 動いているので無視
          value(...args);

        if (result instanceof Promise) {
          // @ts-expect-error 動いているので無視
          return result.then((res) => getOrThrowTransferableResult(res));
        } else {
          return getOrThrowTransferableResult(result);
        }
      };
    },
  });

// @ts-expect-error readonlyになっているが、初期化処理はここで行うので問題ない
window[welcomeSandboxKey] = unwrapApi(
  (
    window as unknown as {
      [welcomeBridgeKey]: WelcomeSandboxWithTransferableResult;
    }
  )[welcomeBridgeKey],
);
