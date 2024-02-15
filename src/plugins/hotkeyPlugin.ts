/**
 * ショートカットキーを管理するプラグイン。
 *
 * HotkeyAction: 実行する処理の名前とコールバックのペア
 * Combination: ショートカットキーを文字列で表したもの
 * HotkeySetting: ユーザーが設定できるもの。ActionとCobinationのペア
 */

/*
 * 用語メモ：
 * action: 何をするか
 * combination: 設定で使う、キーの文字列表記
 * binding: hotkeys-js に登録したコールバック
 * bindingKey: hotkeys-js で使う、キーの文字列表記
 */
import { Plugin, inject, onMounted, onUnmounted } from "vue";
import hotkeys from "hotkeys-js";
import { HotkeyActionNameType, HotkeySettingType } from "@/type/preload";

const hotkeyManagerKey = "hotkeyManager";
export const useHotkeyManager = () => {
  const hotkeyManager = inject<HotkeyManager>(hotkeyManagerKey);
  if (!hotkeyManager) {
    throw new Error("hotkeyManager not found");
  }
  return hotkeyManager;
};

/**
 * ショートカットキーの処理を登録するための型。
 */
export type HotkeyAction = {
  /** どちらのエディタで有効か */
  editor: "talk" | "song";
  /** テキストボックス内で有効か。デフォルトはfalse。 */
  enableInTextbox?: boolean;
  /** 名前。 */
  name: HotkeyActionNameType;
  /** ショートカットキーが押されたときの処理。 */
  callback: (e: KeyboardEvent) => void;
};
type HotkeyActionId = `${"talk" | "song"}:${HotkeyActionNameType}`;

const actionToId = (action: HotkeyAction): HotkeyActionId =>
  `${action.editor}:${action.name}`;

export type HotkeysJs = {
  (
    key: string,
    options: {
      scope: string;
    },
    callback: (e: KeyboardEvent) => void
  ): void;
  unbind: (key: string, scope: string) => void;
  setScope: (scope: string) => void;
};

hotkeys.filter = () => {
  return true;
};
type Log = (message: string, ...args: unknown[]) => void;

/**
 * ショートカットキーの管理を行うクラス。
 */
export class HotkeyManager {
  private actions: HotkeyAction[] = [];
  private settings: HotkeySettingType[] | undefined;
  // 登録されているショートカットキーの組み合わせ。キーは「エディタ:アクション」で、値はcombination。
  private registeredCombinations: Partial<Record<HotkeyActionId, string>> = {};

  private hotkeys: HotkeysJs;
  private log: Log;
  private onMounted: (fn: () => void) => void;
  private onUnmounted: (fn: () => void) => void;

  constructor(
    hotkeys_: HotkeysJs = hotkeys,
    log: Log = (message: string, ...args: unknown[]) => {
      window.electron.logInfo(`[HotkeyManager] ${message}`, ...args);
    },
    onMounted_: (fn: () => void) => void = onMounted,
    onUnmounted_: (fn: () => void) => void = onUnmounted
  ) {
    this.log = log;
    this.hotkeys = hotkeys_;
    this.onMounted = onMounted_;
    this.onUnmounted = onUnmounted_;
  }

  /**
   * ショートカットキーの設定を読み込む。
   */
  load(data: HotkeySettingType[]): void {
    this.settings = data;
    this.refreshBinding();
  }

  private getSetting(action: HotkeyAction): HotkeySettingType {
    if (!this.settings) {
      throw new Error("assert: this.settings != undefined");
    }
    const setting = this.settings.find((s) => s.action === action.name);
    if (!setting) {
      throw new Error("assert: setting != undefined");
    }
    return setting;
  }

  private refreshBinding(): void {
    if (!this.settings) {
      return;
    }
    const changedActions = this.actions.filter((a) => {
      const setting = this.getSetting(a);
      return this.registeredCombinations[actionToId(a)] !== setting.combination;
    });
    if (changedActions.length === 0) {
      return;
    }

    const actionsToUnbind = changedActions.filter((a) => {
      // 未登録のものを弾く
      return this.registeredCombinations[actionToId(a)] != undefined;
    });
    this.unbindActions(actionsToUnbind);

    const actionsToBind = changedActions.filter((a) => {
      const setting = this.getSetting(a);
      // 未割り当て（空文字列）のものを弾く
      return !!setting.combination;
    });
    this.bindActions(actionsToBind);
  }

  private unbindActions(actions: HotkeyAction[]): void {
    for (const action of actions) {
      const combination = this.registeredCombinations[actionToId(action)];
      if (!combination) {
        throw new Error("assert: combination != undefined");
      }
      const bindingKey = combinationToBindingKey(combination);
      this.log("Unbind:", bindingKey, "in", action.editor);
      this.hotkeys.unbind(bindingKey, action.editor);
      this.registeredCombinations[actionToId(action)] = undefined;
    }
  }

  private bindActions(actions: HotkeyAction[]): void {
    for (const action of actions) {
      const setting = this.getSetting(action);
      this.log(
        "Bind:",
        combinationToBindingKey(setting.combination),
        "to",
        action.name,
        "in",
        action.editor
      );
      this.hotkeys(
        combinationToBindingKey(setting.combination),
        { scope: action.editor },
        (e) => {
          const element = e.target;
          // メニュー項目ではショートカットキーを無効化
          if (
            element instanceof HTMLElement &&
            element.classList.contains("q-item")
          ) {
            return;
          }
          if (!action.enableInTextbox) {
            if (
              element instanceof HTMLElement &&
              (element.tagName === "INPUT" ||
                element.tagName === "SELECT" ||
                element.tagName === "TEXTAREA" ||
                element.contentEditable === "true")
            ) {
              return;
            }
          }
          e.preventDefault();
          action.callback(e);
        }
      );
      this.registeredCombinations[actionToId(action)] = setting.combination;
    }
  }

  /**
   * ショートカットキーの設定を変更する。
   */
  replace(data: HotkeySettingType): void {
    if (!this.settings) {
      throw new Error("assert: this.settings != undefined");
    }
    const index = this.settings.findIndex((s) => s.action === data.action);
    if (index === -1) {
      throw new Error("assert: index !== -1");
    }
    this.settings[index] = data;
    this.refreshBinding();
  }

  /**
   * ショートカットキーの処理を登録する。
   */
  register(data: HotkeyAction): void {
    if (
      this.actions.some((a) => a.name === data.name && a.editor === data.editor)
    ) {
      throw new Error(`Action ${data.name} already exists`);
    }
    this.onMounted(() => {
      this.actions.push(data);
      this.refreshBinding();
    });
    this.onUnmounted(() => {
      this.actions = this.actions.filter(
        (a) => a.name !== data.name || a.editor !== data.editor
      );
      // TODO: Unmountした時に、登録したショートカットキーを解除する
    });
  }

  /**
   * エディタが変更されたときに呼び出される。
   */
  onEditorChange(editor: "talk" | "song"): void {
    this.hotkeys.setScope(editor);
    this.log("Editor changed to", editor);
  }
}

const combinationToBindingKey = (combination: string) => {
  return combination.toLowerCase().replaceAll(" ", "+");
};

export const hotkeyPlugin: Plugin = {
  install: (app) => {
    const hotkeyManager = new HotkeyManager();

    app.provide(hotkeyManagerKey, hotkeyManager);
  },
};

export const eventToCombination = (event: KeyboardEvent): string => {
  let recordedCombination = "";
  if (event.ctrlKey) {
    recordedCombination += "Ctrl ";
  }
  if (event.altKey) {
    recordedCombination += "Alt ";
  }
  if (event.shiftKey) {
    recordedCombination += "Shift ";
  }
  // event.metaKey は Mac キーボードでは Cmd キー、Windows キーボードでは Windows キーの押下で true になる
  if (event.metaKey) {
    recordedCombination += "Meta ";
  }
  if (event.key === " ") {
    recordedCombination += "Space";
  } else {
    if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
      recordedCombination = recordedCombination.slice(0, -1);
    } else {
      recordedCombination +=
        event.key.length > 1 ? event.key : event.key.toUpperCase();
    }
  }
  return recordedCombination;
};
