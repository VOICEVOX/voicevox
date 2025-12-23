import {
  WindowManager,
  WindowManagerOption,
  type WindowLoadOption,
} from "./base";

export class WelcomeWindowManager extends WindowManager {
  protected buildLoadUrl(_obj: WindowLoadOption = {}) {
    void _obj;
    return this.buildBaseUrl("welcome/index.html");
  }
}

let windowManager: WelcomeWindowManager | undefined;

export function initializeWelcomeWindowManager(options: WindowManagerOption) {
  windowManager = new WelcomeWindowManager(options);
}

export function getWelcomeWindowManager() {
  if (windowManager == undefined) {
    throw new Error("WindowManager is not initialized");
  }
  return windowManager;
}
