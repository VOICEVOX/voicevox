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
import { Plugin, inject } from "vue";
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

const log = (message: string, ...args: unknown[]) => {
  window.electron.logInfo(`[HotkeyManager] ${message}`, ...args);
};

/**
 * ショートカットキーの処理を登録するための型。
 */
type HotkeyAction = {
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
  unbind: (key: string) => void;
  setScope: (scope: string) => void;
};

/**
 * ショートカットキーの管理を行うクラス。
 */
export class HotkeyManager {
  private actions: HotkeyAction[] = [];
  private settings: HotkeySettingType[] | undefined;
  // 登録されているショートカットキーの組み合わせ。キーは「エディタ:アクション」で、値はcombination。
  private registeredCombinations: Partial<Record<HotkeyActionId, string>> = {};
  private hotkeys: HotkeysJs;

  constructor(hotkeys_: HotkeysJs = hotkeys) {
    this.hotkeys = hotkeys_;
  }

  /**
   * ショートカットキーの設定を読み込む。
   */
  load(data: HotkeySettingType[]): void {
    this.settings = data;
    this.refreshBinding();
  }

  private refreshBinding(): void {
    if (!this.settings) {
      return;
    }
    const changedActions = this.actions.filter((a) => {
      if (!this.settings) throw new Error("assert: this.settings != undefined");
      const setting = this.settings.find((s) => s.action === a.name);
      if (!setting) throw new Error("assert: setting != undefined");
      return this.registeredCombinations[actionToId(a)] !== setting.combination;
    });
    if (changedActions.length === 0) {
      return;
    }
    const bindingsToRemove = new Set(
      changedActions
        .map((key) => {
          const combination = this.registeredCombinations[actionToId(key)];
          if (combination == undefined) {
            return undefined;
          }
          return combinationToBindingKey(combination);
        })
        // 未割り当てはremoveしない
        .filter((key) => key != undefined)
    ) as Set<string>;
    for (const bindingKey of bindingsToRemove.values()) {
      log("Unbind:", bindingKey);
      this.hotkeys.unbind(bindingKey);
    }
    for (const action of changedActions) {
      const setting = this.settings.find((s) => s.action === action.name);
      if (!setting) {
        // unreachableのはず
        throw new Error("assert: setting == undefined");
      }
      if (setting.combination === "") {
        log("Skip(empty combination):", action.name, "in", action.editor);

        this.registeredCombinations[actionToId(action)] = undefined;
        continue;
      }
      log(
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
    this.actions.push(data);
    this.refreshBinding();
  }

  /**
   * エディタが変更されたときに呼び出される。
   */
  onEditorChange(editor: "talk" | "song"): void {
    this.hotkeys.setScope(editor);
    log("Editor changed to", editor);
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
