/**
 * ショートカットキーを管理するプラグイン。
 *
 * HotkeyAction: 何をするか（再生するなど）の名称
 * Combination: ショートカットキーを文字列で表したもの
 * HotkeySetting: ユーザーが設定できるもの。ActionとCobinationのペア
 * HotkeyEntry: プログラムが管理するもの。関数や発動条件など
 */
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

const log = (message: string, ...args: unknown[]) => {
  console.log(`[HotkeyManager] ${message}`, ...args);
};

/**
 * ショートカットキーの処理を登録するための型。
 */
type HotkeyEntry = {
  /** どちらのエディタで有効か */
  editor: "talk" | "song";
  /** テキストボックス内で有効か。デフォルトはfalse。 */
  enableInTextbox?: boolean;
  /** 名前。 */
  action: HotkeyActionType;
  /** ショートカットキーが押されたときの処理。 */
  callback: (e: KeyboardEvent) => void;
};
type HotkeyEntryKey = `${"talk" | "song"}:${HotkeyActionType}`;

const entryToKey = (entry: HotkeyEntry): HotkeyEntryKey =>
  `${entry.editor}:${entry.action}`;

/**
 * ショートカットキーの管理を行うクラス。
 */
export class HotkeyManager {
  private entries: HotkeyEntry[] = [];
  private settings: HotkeySettingType[] = [];
  /// 登録されているショートカットキーの組み合わせ。キーは「エディタ:アクション」で、値はショートカットキーの文字列。
  private registeredCombination: Partial<Record<HotkeyEntryKey, string>> = {};

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
    const changedActions = this.entries.filter(
      (a) =>
        this.registeredCombination[entryToKey(a)] !==
        this.settings.find((s) => s.action === a.action)?.combination
    );
    if (changedActions.length === 0) {
      return;
    }
    const bindingsToRemove = new Set(
      ...changedActions
        .map((key) =>
          hotkeyToCombo(this.registeredCombination[entryToKey(key)] || "")
        )
        // 未割り当てはremoveしない
        .filter((key) => key !== "")
    );
    for (const key of bindingsToRemove.values()) {
      log("Unbind:", key);
      hotkeys.unbind(key);
    }
    for (const action of changedActions) {
      const setting = this.settings.find((s) => s.action === action.action);
      if (!setting) {
        // unreachableのはず
        throw new Error("assert: setting == undefined");
      }
      if (setting.combination === "") {
        log("Skip(empty combination):", action.action, "in", action.editor);
      } else {
        log(
          "Bind:",
          hotkeyToCombo(setting.combination),
          "to",
          action.action,
          "in",
          action.editor
        );
        hotkeys(
          hotkeyToCombo(setting.combination),
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
      }
      this.registeredCombination[entryToKey(action)] = setting.combination;
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
   * ショートカットキーの処理を登録する。
   */
  register(data: HotkeyEntry): void {
    this.entries.push(data);
    this.refreshBinding();
  }

  /**
   * エディタが変更されたときに呼び出される。
   */
  onEditorChange(editor: "talk" | "song"): void {
    hotkeys.setScope(editor);
    log("Editor changed to", editor);
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
