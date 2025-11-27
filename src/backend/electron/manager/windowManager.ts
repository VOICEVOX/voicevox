import { WindowManager } from "./windowManagerBase";
import type {
  WindowManagerOption,
  WindowLoadOption,
} from "./windowManagerBase";
import { IndexWindowManager } from "./indexWindowManager";
import { WelcomeWindowManager } from "./welcomeWindowManager";

export type WindowManagerInitializeOption = WindowManagerOption & {
  windowType?: "index" | "welcome";
};

let windowManager: WindowManager | undefined;

export function initializeWindowManager(
  payload: WindowManagerInitializeOption,
) {
  const { windowType = "index", ...options } = payload;
  if (windowType === "welcome") {
    windowManager = new WelcomeWindowManager(options);
    return;
  }
  windowManager = new IndexWindowManager(options);
}

export function getWindowManager() {
  if (windowManager == undefined) {
    throw new Error("WindowManager is not initialized");
  }
  return windowManager;
}

export { WindowManager };
export type { WindowManagerOption, WindowLoadOption };
