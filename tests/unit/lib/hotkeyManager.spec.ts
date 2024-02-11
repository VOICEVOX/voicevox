import { it } from "vitest";
import { HotkeyManager, HotkeysJs } from "@/plugins/hotkeyPlugin";

type DummyHotkeysJs = HotkeysJs & {
  registeredHotkeys: {
    key: string;
    scope: string;
    // callbackを持たせると比較が面倒になるので持たせない
    // callback: (e: KeyboardEvent) => void;
  }[];
  currentScope: string;
};
const createHotkeyManager = (): {
  hotkeyManager: HotkeyManager;
  dummyHotkeysJs: DummyHotkeysJs;
} => {
  const registeredHotkeys: DummyHotkeysJs["registeredHotkeys"] = [];
  const dummyHotkeysJs: DummyHotkeysJs = (
    key: string,
    { scope }: { scope: string }
  ) => {
    registeredHotkeys.push({ key, scope });
  };
  dummyHotkeysJs.unbind = (key: string) => {
    const index = dummyHotkeysJs.registeredHotkeys.findIndex(
      (h) => h.key === key
    );
    if (index !== -1) {
      registeredHotkeys.splice(index, 1);
    }
  };
  dummyHotkeysJs.setScope = (scope: string) => {
    dummyHotkeysJs.currentScope = scope;
  };
  dummyHotkeysJs.registeredHotkeys = registeredHotkeys;
  dummyHotkeysJs.currentScope = "talk";
  return { hotkeyManager: new HotkeyManager(dummyHotkeysJs), dummyHotkeysJs };
};

// @ts-expect-error これがないとログを吐けずにエラーを吐く
window.electron = {
  logInfo: console.log,
};

it("registerできる", () => {
  const { hotkeyManager } = createHotkeyManager();
  hotkeyManager.register({
    editor: "talk",
    name: "音声書き出し",
    callback: () => {
      /* noop */
    },
  });
});

describe("設定変更", () => {
  let hotkeyManager: HotkeyManager;
  let dummyHotkeysJs: DummyHotkeysJs;
  beforeEach(() => {
    const { hotkeyManager: hotkeyManager_, dummyHotkeysJs: dummyHotkeysJs_ } =
      createHotkeyManager();
    hotkeyManager = hotkeyManager_;
    dummyHotkeysJs = dummyHotkeysJs_;
    const callback = () => {
      /* noop */
    };
    hotkeyManager.register({
      editor: "talk",
      name: "音声書き出し",
      callback,
    });
    hotkeyManager.register({
      editor: "talk",
      name: "選択音声を書き出し",
      callback,
    });
    hotkeyManager.load([
      {
        action: "音声書き出し",
        combination: "1",
      },
      {
        action: "選択音声を書き出し",
        combination: "",
      },
    ]);
  });

  it("設定を登録するとhotkeysが更新される", () => {
    // 設定登録はbeforeEachの部分で行っている
    expect(dummyHotkeysJs.registeredHotkeys).toEqual([
      { key: "1", scope: "talk" },
    ]);
  });

  it("設定を更新するとhotkeysが更新される", () => {
    hotkeyManager.replace({
      action: "音声書き出し",
      combination: "a",
    });

    expect(dummyHotkeysJs.registeredHotkeys).toEqual([
      { key: "a", scope: "talk" },
    ]);
  });

  it("未割り当てにするとhotkeysから削除される", () => {
    hotkeyManager.replace({
      action: "音声書き出し",
      combination: "",
    });
    expect(dummyHotkeysJs.registeredHotkeys).toEqual([]);
  });

  it("未割り当てから割り当てるとhotkeysが更新される", () => {
    hotkeyManager.replace({
      action: "選択音声を書き出し",
      combination: "2",
    });
    expect(dummyHotkeysJs.registeredHotkeys).toEqual([
      { key: "1", scope: "talk" },
      { key: "2", scope: "talk" },
    ]);
  });
});
