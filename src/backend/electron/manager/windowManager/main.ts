import { getEngineAndVvppController } from "../../engineAndVvppController";
import {
  WindowManager,
  WindowManagerOption,
  type WindowLoadOption,
} from "./base";
import { createLogger } from "@/helpers/log";

const log = createLogger("WindowManager");

export class MainWindowManager extends WindowManager {
  protected buildLoadUrl(obj: WindowLoadOption) {
    const url = this.buildBaseUrl("index.html");
    url.searchParams.set(
      "isMultiEngineOffMode",
      (obj?.isMultiEngineOffMode ?? false).toString(),
    );
    return url;
  }

  public override async reload(isMultiEngineOffMode: boolean | undefined) {
    const win = this.getWindow();
    win.hide(); // FIXME: ダミーページ表示のほうが良い

    // 一旦適当なURLに飛ばしてページをアンロードする
    await win.loadURL("about:blank");

    log.info("Checking ENGINE status before reload app");
    const engineAndVvppController = getEngineAndVvppController();
    await engineAndVvppController.cleanupEngines();

    log.info("Post engine kill process done. Now reloading app");

    await engineAndVvppController.launchEngines();

    await this.load({
      isMultiEngineOffMode: !!isMultiEngineOffMode,
    });
    win.show();
  }
}

let windowManager: MainWindowManager | undefined;

export function initializeMainWindowManager(options: WindowManagerOption) {
  windowManager = new MainWindowManager(options);
}

export function getMainWindowManager() {
  if (windowManager == undefined) {
    throw new Error("WindowManager is not initialized");
  }
  return windowManager;
}
