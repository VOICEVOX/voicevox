import { describe, it, expect, beforeEach } from "vitest";
import { HotkeyManager, HotkeysJs, HotkeyAction } from "@/plugins/hotkeyPlugin";
import { HotkeyCombination, HotkeySettingType } from "@/domain/hotkeyAction";

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
    { scope }: { scope: string },
  ) => {
    if (registeredHotkeys.some((h) => h.key === key && h.scope === scope)) {
      throw new Error("assert: duplicate key");
    }
    registeredHotkeys.push({ key, scope });
  };
  dummyHotkeysJs.unbind = (key: string) => {
    const index = dummyHotkeysJs.registeredHotkeys.findIndex(
      (h) => h.key === key,
    );
    if (index === -1) {
      throw new Error("assert: unknown binding");
    }
    registeredHotkeys.splice(index, 1);
  };
  dummyHotkeysJs.setScope = (scope: string) => {
    dummyHotkeysJs.currentScope = scope;
  };
  dummyHotkeysJs.registeredHotkeys = registeredHotkeys;
  dummyHotkeysJs.currentScope = "talk";
  return {
    hotkeyManager: new HotkeyManager(dummyHotkeysJs, () => {
      /* noop */
    }),
    dummyHotkeysJs,
  };
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

it("unregisterできる", () => {
  const { hotkeyManager, dummyHotkeysJs } = createHotkeyManager();
  const action = {
    editor: "talk",
    name: "音声書き出し",
    callback: () => {
      /* noop */
    },
  } as const;
  hotkeyManager.load([
    {
      action: "音声書き出し",
      combination: HotkeyCombination("1"),
    },
  ]);
  hotkeyManager.register(action);
  expect(dummyHotkeysJs.registeredHotkeys).toEqual([
    { key: "1", scope: "talk" },
  ]);
  hotkeyManager.unregister(action);
  expect(dummyHotkeysJs.registeredHotkeys).toEqual([]);
});

const callback = () => {
  /* noop */
};
const dummyAction: HotkeyAction = {
  editor: "talk",
  name: "音声書き出し",
  callback,
};
const createDummySetting = (combination: string): HotkeySettingType => ({
  action: "音声書き出し",
  combination: HotkeyCombination(combination),
});

describe("設定変更", () => {
  let hotkeyManager: HotkeyManager;
  let dummyHotkeysJs: DummyHotkeysJs;
  beforeEach(() => {
    const { hotkeyManager: hotkeyManager_, dummyHotkeysJs: dummyHotkeysJs_ } =
      createHotkeyManager();
    hotkeyManager = hotkeyManager_;
    dummyHotkeysJs = dummyHotkeysJs_;
  });

  it("設定を登録するとhotkeysが更新される", () => {
    hotkeyManager.register(dummyAction);
    hotkeyManager.load([createDummySetting("1")]);
    expect(dummyHotkeysJs.registeredHotkeys).toEqual([
      { key: "1", scope: "talk" },
    ]);
  });

  it("設定を更新するとhotkeysが更新される", () => {
    hotkeyManager.register(dummyAction);
    hotkeyManager.load([createDummySetting("1")]);
    hotkeyManager.replace(createDummySetting("a"));

    expect(dummyHotkeysJs.registeredHotkeys).toEqual([
      { key: "a", scope: "talk" },
    ]);
  });

  it("未割り当てにするとhotkeysから削除される", () => {
    hotkeyManager.register(dummyAction);
    hotkeyManager.load([createDummySetting("1")]);
    hotkeyManager.replace(createDummySetting(""));
    expect(dummyHotkeysJs.registeredHotkeys).toEqual([]);
  });

  it("未割り当てから割り当てるとhotkeysが更新される", () => {
    hotkeyManager.register(dummyAction);
    hotkeyManager.load([createDummySetting("")]);
    expect(dummyHotkeysJs.registeredHotkeys).toEqual([]);
    hotkeyManager.replace(createDummySetting("1"));
    expect(dummyHotkeysJs.registeredHotkeys).toEqual([
      { key: "1", scope: "talk" },
    ]);
  });

  it("割り当て -> 未割り当て -> 割り当てでhotkeysが更新される", () => {
    hotkeyManager.register(dummyAction);
    hotkeyManager.load([createDummySetting("1")]);

    expect(dummyHotkeysJs.registeredHotkeys).toEqual([
      { key: "1", scope: "talk" },
    ]);

    hotkeyManager.replace(createDummySetting(""));
    expect(dummyHotkeysJs.registeredHotkeys).toEqual([]);

    hotkeyManager.replace(createDummySetting("a"));
    expect(dummyHotkeysJs.registeredHotkeys).toEqual([
      { key: "a", scope: "talk" },
    ]);
  });
});
