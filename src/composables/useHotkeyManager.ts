import Mousetrap from "mousetrap";
import { HotkeyActionType, HotkeySettingType } from "@/type/preload";

let hotkeyManager: HotkeyManager | undefined = undefined;
export const useHotkeyManager = () => {
  if (!hotkeyManager) {
    hotkeyManager = new HotkeyManager();
  }
  return hotkeyManager;
};

type HotkeyRegistration = {
  editor: "talk" | "song";
  enableInTextbox: boolean;
  action: HotkeyActionType;
  callback: () => boolean;
};

export class HotkeyManager {
  actions: HotkeyRegistration[] = [];
  settings: HotkeySettingType[] = [];
  registered: Partial<Record<HotkeyActionType, string>> = {};

  load(data: HotkeySettingType[]): void {
    const newSettings = this.settings.filter(
      (s) => !data.find((d) => d.action === s.action)
    );
    this.settings = newSettings.concat(data);
    this.refresh();
  }

  private refresh(): void {
    if (this.settings.length === 0) {
      return;
    }
    const changedActions = this.actions.filter(
      (a) =>
        this.registered[a.action] !==
        this.settings.find((s) => s.action === a.action)?.combination
    );
    for (const action of changedActions) {
      const registered = this.registered[action.action];
      if (registered) {
        Mousetrap.unbind(hotkeyToCombo(registered));
      }
      const setting = this.settings.find((s) => s.action === action.action);
      if (!setting) {
        // unreachableのはず
        throw new Error("assert: setting == undefined");
      }

      Mousetrap.bind(hotkeyToCombo(setting.combination), (e) => {
        if (!action.enableInTextbox) {
          const element = e.target as HTMLElement;
          if (
            element.tagName === "INPUT" ||
            element.tagName === "SELECT" ||
            element.tagName === "TEXTAREA" ||
            (element instanceof HTMLElement &&
              element.contentEditable === "true") ||
            // メニュー項目ではショートカットキーを無効化
            element.classList.contains("q-item")
          ) {
            return true;
          }
        }
        // TODO: もっと良い感じの取得方法があれば変更する
        const path = location.hash.split("/")[1] as "talk" | "song";
        if (path === action.editor) {
          return action.callback();
        }
      });
    }
  }

  replace(data: HotkeySettingType): void {
    throw new Error("unimplemented");
  }

  register(data: HotkeyRegistration): void {
    this.actions.push(data);
    this.refresh();
  }
}

const hotkeyToCombo = (hotkeyCombo: string) => {
  return hotkeyCombo.toLowerCase().replaceAll(" ", "+");
};
