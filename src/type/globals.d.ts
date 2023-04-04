// Include global variables to build immer source code
export * from "immer/src/types/globals";
import { SandboxKey } from "./preload";

declare global {
  interface HTMLAudioElement {
    setSinkId(deviceID: string): Promise<undefined>; // setSinkIdを認識してくれないため
  }

  interface Window {
    readonly [SandboxKey]: import("./preload").Sandbox;
  }
}
