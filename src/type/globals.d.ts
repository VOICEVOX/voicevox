// Include global variables to build immer source code
export * from "immer/src/types/globals";
// showDirectoryPicker などのAPIをブラウザで使用するためにimportしている
import "@types/wicg-file-system-access";
import type { WelcomeSandbox, welcomeSandboxKey } from "../welcome/preloadType";
import type { Sandbox, SandboxKey } from "./preload";

declare global {
  interface HTMLAudioElement {
    setSinkId(deviceID: string): Promise<undefined>; // setSinkIdを認識してくれないため
  }

  interface AudioContext {
    setSinkId: (sinkId: string) => Promise<void>;
  }

  interface Window {
    readonly [SandboxKey]: Sandbox;
    readonly [welcomeSandboxKey]: WelcomeSandbox;
  }

  interface Navigator {
    // navigator.userAgentDataを認識してくれないため
    userAgentData: {
      readonly platform: string;
    };
  }
}
