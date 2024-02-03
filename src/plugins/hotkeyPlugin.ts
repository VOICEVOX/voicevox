import { Plugin, inject } from "vue";
import hotkeys from "hotkeys-js";
import { HotkeyActionType, HotkeySettingType } from "@/type/preload";

const hotkeyManagerKey = "hotkeyManager";
export const useHotkeyManager = () => {
  const hotkeyManager = inject<HotkeyManager>(hotkeyManagerKey);
  if (!hotkeyManager) {
    throw new Error("hotkeyManager not found");
  }
  return hotkeyManager;
};

/**
 * ショートカットキーの情報を格納する型。
 */
type HotkeyEntry = {
  /** どちらのエディタで有効か */
  editor: "talk" | "song";
  /** テキストボックス内で有効か。デフォルトはfalse。 */
  enableInTextbox?: boolean;
  /** 名前。 */
  action: HotkeyActionType;
  /** ブラウザのデフォルトの挙動をキャンセルするか。デフォルトはfalse。 */
  keepDefaultBehavior?: boolean;
  /** ショートカットキーが押されたときの処理。 */
  callback: (e: KeyboardEvent) => void;
};

/**
 * ショートカットキーの管理を行うクラス。
 */
export class HotkeyManager {
  actions: HotkeyEntry[] = [];
  settings: HotkeySettingType[] = [];
  registered: Partial<Record<HotkeyActionType, string>> = {};

  constructor() {
    // デフォルトだとテキスト欄でのショートカットキーが効かないので、テキスト欄でも効くようにする
    hotkeys.filter = () => true;
  }

  /**
   * ショートカットキーの設定を読み込む。
   */
  load(data: HotkeySettingType[]): void {
    this.settings = data;
    this.refreshBinding();
  }

  private refreshBinding(): void {
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
        hotkeys.unbind(hotkeyToCombo(registered));
      }
      const setting = this.settings.find((s) => s.action === action.action);
      if (!setting) {
        // unreachableのはず
        throw new Error("assert: setting == undefined");
      }

      hotkeys(hotkeyToCombo(setting.combination), (e) => {
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
            return;
          }
        }
        // TODO: もっと良い感じの取得方法があれば変更する
        const path = location.hash.split("/")[1] as "talk" | "song";
        if (path === action.editor) {
          if (!action.keepDefaultBehavior) e.preventDefault();
          action.callback(e);
        }
      });
      this.registered[action.action] = setting.combination;
    }
  }

  /**
   * ショートカットキーの設定を変更する。
   */
  replace(data: HotkeySettingType): void {
    const index = this.settings.findIndex((s) => s.action === data.action);
    if (index === -1) {
      throw new Error("assert: index !== -1");
    }
    this.settings[index] = data;
    this.refreshBinding();
  }

  /**
   * ショートカットキーの登録を行う。
   */
  register(data: HotkeyEntry): void {
    this.actions.push(data);
    this.refreshBinding();
  }
}

const hotkeyToCombo = (hotkeyCombo: string) => {
  return hotkeyCombo.toLowerCase().replaceAll(" ", "+");
};

export const hotkeyPlugin: Plugin = {
  install: (app) => {
    const hotkeyManager = new HotkeyManager();

    app.provide(hotkeyManagerKey, hotkeyManager);
  },
};

export const parseCombo = (event: KeyboardEvent): string => {
  let recordedCombo = "";
  if (event.ctrlKey) {
    recordedCombo += "Ctrl ";
  }
  if (event.altKey) {
    recordedCombo += "Alt ";
  }
  if (event.shiftKey) {
    recordedCombo += "Shift ";
  }
  // event.metaKey は Mac キーボードでは Cmd キー、Windows キーボードでは Windows キーの押下で true になる
  if (event.metaKey) {
    recordedCombo += "Meta ";
  }
  if (event.key === " ") {
    recordedCombo += "Space";
  } else {
    if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
      recordedCombo = recordedCombo.slice(0, -1);
    } else {
      recordedCombo +=
        event.key.length > 1 ? event.key : event.key.toUpperCase();
    }
  }
  return recordedCombo;
};
