import { WindowManager } from "./windowManager/base";
import type {
  WindowManagerOption,
  WindowLoadOption,
} from "./windowManager/base";
import { IndexWindowManager } from "./windowManager/main";
import { WelcomeWindowManager } from "./windowManager/welcome";

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
