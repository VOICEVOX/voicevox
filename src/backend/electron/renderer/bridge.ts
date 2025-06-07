/**
 * ElectronのpreloadプロセスとMainWorldプロセスの橋渡し。
 */

import {
  DisplayableResult,
  getOrThrowDisplayableResult,
} from "../displayableResultHelper";
import { SandboxKey, Sandbox } from "@/type/preload";

export const BridgeKey = "electronBridge";

export type SandboxWithDisplayableResult = {
  [K in keyof Sandbox]: (
    ...args: Parameters<Sandbox[K]>
  ) => ReturnType<Sandbox[K]> extends Promise<infer R>
    ? Promise<DisplayableResult<R>>
    : DisplayableResult<ReturnType<Sandbox[K]>>;
};

const unwrapApi = (baseApi: SandboxWithDisplayableResult): Sandbox =>
  new Proxy<Sandbox>({} as Sandbox, {
    get(_target, prop: keyof SandboxWithDisplayableResult) {
      const value = baseApi[prop];
      if (typeof value !== "function") {
        return value;
      }

      // 元の関数を呼び出し、getOrThrowDisplayableResultで中の値を取り出す。
      // Promiseが帰ってきた場合はthenの中で取り出す。
      return (
        ...args: Parameters<SandboxWithDisplayableResult[typeof prop]>
      ) => {
        const result: ReturnType<SandboxWithDisplayableResult[typeof prop]> =
          // @ts-expect-error 動いているので無視
          value(...args);

        if (result instanceof Promise) {
          return result.then((res) =>
            // @ts-expect-error 動いているので無視
            getOrThrowDisplayableResult(res),
          );
        } else {
          // @ts-expect-error 動いているので無視
          return getOrThrowDisplayableResult(result);
        }
      };
    },
  });

// @ts-expect-error readonlyになっているが、初期化処理はここで行うので問題ない
window[SandboxKey] = unwrapApi(
  (
    window as unknown as {
      [BridgeKey]: SandboxWithDisplayableResult;
    }
  )[BridgeKey],
);
