/**
 * ショートカットキーを管理するプラグイン。
 *
 * HotkeyAction: 実行する処理の名前とコールバックのペア
 * HotkeySetting: ユーザーが設定できるもの。ActionとCobinationのペア
 * Combination: ショートカットキーを文字列で表したもの
 * binding: hotkeys-js に登録したコールバック
 * bindingKey: hotkeys-js で使う、キーの文字列表記
 */
import { Plugin, inject, onMounted, onUnmounted } from "vue";
import hotkeys from "hotkeys-js";
import {
  HotkeyActionNameType,
  HotkeyCombination,
  HotkeySettingType,
} from "@/domain/hotkeyAction";
import { createLogger } from "@/helpers/log";
import { Brand } from "@/type/utility";

const hotkeyManagerKey = "hotkeyManager";
export const useHotkeyManager = () => {
  const hotkeyManager = inject<HotkeyManager>(hotkeyManagerKey);
  if (!hotkeyManager) {
    throw new Error("hotkeyManager not found");
  }
  const registerHotkeyWithCleanup = (action: HotkeyAction) => {
    onMounted(() => {
      hotkeyManager.register(action);
    });
    onUnmounted(() => {
      hotkeyManager.unregister(action);
    });
  };
  return { hotkeyManager, registerHotkeyWithCleanup };
};

type Editor = "talk" | "song";

type BindingKey = Brand<string, "BindingKey">;

/**
 * ショートカットキーの処理を登録するための型。
 */
export type HotkeyAction = {
  /** どちらのエディタで有効か */
  editor: Editor;
  /** テキストボックス内で有効か。デフォルトはfalse。 */
  enableInTextbox?: boolean;
  /** 名前。 */
  name: HotkeyActionNameType;
  /** ショートカットキーが押されたときの処理。 */
  callback: (e: KeyboardEvent) => void;
};

export type HotkeysJs = {
  (
    key: BindingKey,
    options: {
      scope: string;
    },
    callback: (e: KeyboardEvent) => void,
  ): void;
  unbind: (key: BindingKey, scope: string) => void;
  setScope: (scope: string) => void;
};

// デフォルトはテキストボックス内でショートカットキー無効なので有効にする
hotkeys.filter = () => {
  return true;
};
type Log = (message: string, ...args: unknown[]) => void;

type RegisteredCombination = {
  editor: Editor;
  name: HotkeyActionNameType;
  combination: HotkeyCombination;
};

interface HotkeyTarget {
  name: HotkeyActionNameType;
  editor: Editor;
}
const isSameHotkeyTarget = (a: HotkeyTarget) => (b: HotkeyTarget) => {
  return a.name === b.name && a.editor === b.editor;
};
const isNotSameHotkeyTarget = (a: HotkeyTarget) => (b: HotkeyTarget) => {
  return a.name !== b.name || a.editor !== b.editor;
};

/**
 * ショートカットキーの管理を行うクラス。
 */
export class HotkeyManager {
  /** 登録されたHotkeyAction */
  private actions: HotkeyAction[] = [];
  /** ユーザーのショートカットキー設定 */
  private settings: HotkeySettingType[] | undefined; // ユーザーのショートカットキー設定
  /** hotkeys-jsに登録されたショートカットキーの組み合わせ */
  private registeredCombinations: RegisteredCombination[] = [];

  private hotkeys: HotkeysJs;
  private log: Log;

  constructor(
    hotkeys_: HotkeysJs = hotkeys,
    log: Log = createLogger("HotkeyManager").info,
  ) {
    this.log = log;
    this.hotkeys = hotkeys_;
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

  private getRegisteredCombination(
    action: HotkeyAction,
  ): HotkeyCombination | undefined {
    return this.registeredCombinations.find(isSameHotkeyTarget(action))
      ?.combination;
  }

  private refreshBinding(): void {
    if (!this.settings) {
      return;
    }

    const changedActions = this.actions.filter((a) => {
      const setting = this.getSetting(a);
      return this.getRegisteredCombination(a) !== setting.combination;
    });

    // 不要なBindingを削除
    const unbindedCombinations = changedActions.flatMap((a) => {
      const combination = this.registeredCombinations.find(
        isSameHotkeyTarget(a),
      );
      // 空じゃないCombinationを探す
      return combination?.combination ? [combination] : [];
    });
    const unregisteredCombinations = this.registeredCombinations.filter(
      (c) => !this.actions.some(isSameHotkeyTarget(c)),
    );
    this.unbindActions([...unbindedCombinations, ...unregisteredCombinations]);

    // 新しいBindingを登録
    const actionsToBind = changedActions.filter((a) => {
      const setting = this.getSetting(a);
      // 未割り当て（空文字列）のものを弾く
      return !!setting.combination;
    });
    this.bindActions(actionsToBind);
  }

  private unbindActions(combinations: RegisteredCombination[]): void {
    for (const combination of combinations) {
      const bindingKey = combinationToBindingKey(combination.combination);
      this.log("Unbind:", bindingKey, "in", combination.editor);
      this.hotkeys.unbind(bindingKey, combination.editor);
      this.registeredCombinations = this.registeredCombinations.filter(
        isNotSameHotkeyTarget(combination),
      );
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
        action.editor,
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
        },
      );
      this.registeredCombinations = this.registeredCombinations.filter(
        isNotSameHotkeyTarget(action),
      );
      this.registeredCombinations.push({
        editor: action.editor,
        name: action.name,
        combination: setting.combination,
      });
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
      throw new Error(`Action ${data.name} in ${data.editor} already exists`);
    }
    this.actions.push(data);
    this.refreshBinding();
  }

  /**
   * ショートカットキーの処理の登録を解除する。
   */
  unregister(data: HotkeyAction): void {
    this.actions = this.actions.filter(isNotSameHotkeyTarget(data));
    this.refreshBinding();
  }

  /**
   * エディタが変更されたときに呼び出される。
   */
  onEditorChange(editor: "talk" | "song"): void {
    this.hotkeys.setScope(editor);
    this.log("Editor changed to", editor);
  }
}

/** hotkeys-js用のキーに変換する */
const combinationToBindingKey = (
  combination: HotkeyCombination,
): BindingKey => {
  // MetaキーはCommandキーとして扱う
  // NOTE: hotkeys-jsにはWinキーが無く、Commandキーとして扱われている
  // NOTE: Metaキーは以前採用していたmousetrapがそうだった名残り
  // NOTE: hotkeys-jsでは方向キーのarrowプレフィックスが不要
  const bindingKey = combination
    .toLowerCase()
    .split(" ")
    .map((key) => (key === "meta" ? "command" : key))
    .map((key) => key.replace("arrow", ""))
    .join("+");
  return bindingKey as BindingKey;
};

export const hotkeyPlugin: Plugin = {
  install: (app) => {
    const hotkeyManager = new HotkeyManager();

    app.provide(hotkeyManagerKey, hotkeyManager);
  },
};

/** キーボードイベントをショートカットキーの文字列に変換する */
export const eventToCombination = (event: KeyboardEvent): HotkeyCombination => {
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
  // event.codeからevent.key形式へと変換
  // TODO: 主要なキーも使えるようにする
  const eventKey = event.code.replace(/Key|Digit|Numpad/, "");
  // 英字 数字 上下左右 Enter Space Backspace Delete Escape F1~ - /のみ認める
  if (
    /^([A-Z]|\d|Arrow(Up|Down|Left|Right)|Enter|Space|Backspace|Delete|Escape|F\d+|-|\/)$/.test(
      eventKey,
    )
  ) {
    recordedCombination += eventKey;
  }
  // 修飾キーのみだった場合末尾がスペースになるので削除
  recordedCombination = recordedCombination.replace(/\s$/, "");
  return HotkeyCombination(recordedCombination);
};
