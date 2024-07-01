/**
 * ショートカットキーを管理するプラグイン。
 *
 * HotkeyAction: 実行する処理の名前とコールバックのペア
 * HotkeySetting: ユーザーが設定できるもの。ActionとCobinationのペア
 * Combination: ショートカットキーを文字列で表したもの
 * binding: 登録したコールバック
 * bindingKey: キーの文字列表記
 */
import { Plugin, inject, onMounted, onUnmounted } from "vue";
import {
  HotkeyActionNameType,
  HotkeyCombination,
  HotkeySettingType,
  EditorType,
} from "@/type/preload";
import { createLogger } from "@/domain/frontend/log";

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

type Editor = "talk" | "song" | "talk&song";

type BindingKey = string & { __brand: "BindingKey" }; // BindingKey専用のブランド型

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
  /** スコープ */
  private scope: EditorType | undefined;
  /** ユーザーのショートカットキー設定 */
  private settings: HotkeySettingType[] | undefined; // ユーザーのショートカットキー設定
  /** 登録されたショートカットキーの組み合わせ */
  private registeredCombinations: RegisteredCombination[] = [];

  private log: Log;

  constructor(log: Log = createLogger("HotkeyManager").info) {
    this.log = log;
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
  onEditorChange(editor: EditorType): void {
    this.scope = editor;
    this.log("Editor changed to", editor);
  }

  keyInput(e: KeyboardEvent): void {
    const element = e.target;

    if (this.scope == undefined) {
      console.error("hotkeyPluginのスコープが未設定です");
      return;
    }

    // メニュー項目・ダイアログではショートカットキーを無効化
    if (
      element instanceof HTMLElement &&
      (element.getAttribute("role") == "menu" ||
        element.classList.contains("q-dialog__inner"))
    ) {
      return;
    }

    const isInTextbox =
      element instanceof HTMLElement &&
      (element.tagName === "INPUT" ||
        element.tagName === "SELECT" ||
        element.tagName === "TEXTAREA" ||
        element.contentEditable === "true");

    const combination = combinationToBindingKey(eventToCombination(e));

    const actions = this.actions
      .filter((item) => !isInTextbox || item.enableInTextbox)
      .filter(
        (item) =>
          combinationToBindingKey(this.getSetting(item).combination) ==
          combination,
      )
      .filter((item) => {
        if (item.editor === "talk&song") {
          return this.scope === "talk" || this.scope === "song";
        } else if (item.editor === "talk") {
          return this.scope === "talk";
        } else if (item.editor === "song") {
          return this.scope === "song";
        } else {
          console.error("scopeに対する処理が設定されていません");
        }
      });
    if (actions.length == 0) {
      return;
    }
    e.preventDefault();
    actions.forEach((action) => action.callback(e));
  }

  /**
   * 現在登録されているHotkeyActionをすべて取得する
   */
  getAllActions(): HotkeyAction[] {
    return this.actions;
  }
}

/** 判定用のキーに変換する */
const combinationToBindingKey = (
  combination: HotkeyCombination,
): BindingKey => {
  // MetaキーはCommandキーとして扱う
  // NOTE: Metaキーは以前採用していたmousetrapがそうだった名残り
  // 順番が違うものも一致させるために並べ替え
  return combination.split(" ").sort().join(" ") as BindingKey;
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
