import { getOrThrowDisplayableResult } from "../displayableResultHelper";
import { SandboxKey, Sandbox } from "@/type/preload";

export const BridgeKey = "electronBridge";

declare global {
  interface Window {
    [BridgeKey]: Sandbox;
  }
}

const unwrapDisplayableResultFromMainWorld = (api: Sandbox): Sandbox => {
  const wrappedApi = {} as Sandbox;
  for (const key in api) {
    const propKey = key as keyof Sandbox;
    // @ts-expect-error とりあえず動くので無視
    wrappedApi[propKey] = async (...args: unknown[]) => {
      // @ts-expect-error とりあえず動くので無視
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const displayableResult = await api[propKey](...args);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return getOrThrowDisplayableResult(displayableResult);
    };
  }
  return wrappedApi;
};

// @ts-expect-error readonlyになっているが、初期化処理はここで行うので問題ない
window[SandboxKey] = unwrapDisplayableResultFromMainWorld(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  window[BridgeKey],
);
