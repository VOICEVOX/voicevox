/**
 * ElectronのpreloadプロセスとMainWorldプロセスの橋渡し。
 */

import {
  TransferableResult,
  getOrThrowTransferableResult,
} from "../transferableResultHelper";
import { SandboxKey, Sandbox } from "@/type/preload";

export const BridgeKey = "electronBridge";

export type SandboxWithTransferableResult = {
  [K in keyof Sandbox]: (
    ...args: Parameters<Sandbox[K]>
  ) => ReturnType<Sandbox[K]> extends Promise<infer R>
    ? Promise<TransferableResult<R>>
    : TransferableResult<ReturnType<Sandbox[K]>>;
};

const unwrapApi = (baseApi: SandboxWithTransferableResult): Sandbox =>
  new Proxy<Sandbox>({} as Sandbox, {
    get(_target, prop: keyof SandboxWithTransferableResult) {
      const value = baseApi[prop];
      if (typeof value !== "function") {
        return value;
      }

      // 元の関数を呼び出し、getOrThrowTransferableResultで中の値を取り出す。
      // Promiseが帰ってきた場合はthenの中で取り出す。
      return (
        ...args: Parameters<SandboxWithTransferableResult[typeof prop]>
      ) => {
        const result: ReturnType<SandboxWithTransferableResult[typeof prop]> =
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
window[SandboxKey] = unwrapApi(
  (
    window as unknown as {
      [BridgeKey]: SandboxWithTransferableResult;
    }
  )[BridgeKey],
);
