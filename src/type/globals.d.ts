// Include global variables to build immer source code
export * from "immer/src/types/globals";
// showDirectoryPicker などのAPIをブラウザで使用するためにimportしている
import "@types/wicg-file-system-access";
import { welcomeSandboxKey } from "../welcome/preloadType";
import { SandboxKey } from "./preload";

declare global {
  interface HTMLAudioElement {
    setSinkId(deviceID: string): Promise<undefined>; // setSinkIdを認識してくれないため
  }

  interface AudioContext {
    setSinkId: (sinkId: string) => Promise<void>;
  }

  interface Window {
    readonly [SandboxKey]: import("./preload").Sandbox;
    readonly [welcomeSandboxKey]: import("../welcome/preloadType").WelcomeSandbox;
  }

  interface Navigator {
    // navigator.userAgentDataを認識してくれないため
    userAgentData: {
      readonly platform: string;
    };
  }
}
