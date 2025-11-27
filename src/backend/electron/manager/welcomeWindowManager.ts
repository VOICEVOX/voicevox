import { WindowManager, type WindowLoadOption } from "./windowManagerBase";

export class WelcomeWindowManager extends WindowManager {
  protected buildLoadUrl(_obj: WindowLoadOption = {}) {
    void _obj;
    return this.buildBaseUrl("welcome.html");
  }
}
