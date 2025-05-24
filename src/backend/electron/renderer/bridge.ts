import { getOrThrowDisplayableResult } from "../displayableResultHelper";
import { SandboxKey, Sandbox } from "@/type/preload";

export const BridgeKey = "electronBridge";

declare global {
  interface Window {
    [BridgeKey]: Sandbox;
  }
}

const unwrapApi = (baseApi: Sandbox): Sandbox => {
  const unwrappedApi = {} as Sandbox;
  for (const key in baseApi) {
    const propKey = key as keyof Sandbox;
    // @ts-expect-error とりあえず動くので無視
    unwrappedApi[propKey] = async (...args: unknown[]) => {
      // @ts-expect-error とりあえず動くので無視
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const displayableResult = await baseApi[propKey](...args);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return getOrThrowDisplayableResult(displayableResult);
    };
  }
  return unwrappedApi;
};

// @ts-expect-error readonlyになっているが、初期化処理はここで行うので問題ない
window[SandboxKey] = unwrapApi(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  window[BridgeKey],
);
