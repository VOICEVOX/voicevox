import { describe, it, expect, beforeEach } from "vitest";
import { HotkeyManager, HotkeyAction } from "@/plugins/hotkeyPlugin";
import { HotkeyCombination, HotkeySettingType } from "@/type/preload";

type DummyKeyboardEvent = {
  key: string;
  code: string;
  target: EventTarget | null;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  preventDefault: () => void;
};
const createDummyInput = (
  combinationKey: string,
  combinationCode: string,
): DummyKeyboardEvent => {
  const dummyInput: DummyKeyboardEvent = {
    key: combinationKey,
    code: combinationCode,
    target: null,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    preventDefault: () => {
      /* noop */
    },
  };
  return dummyInput;
};

const createHotkeyManager = (): HotkeyManager => {
  return new HotkeyManager(() => {
    /* noop */
  });
};

it("registerできる", () => {
  const hotkeyManager = createHotkeyManager();
  hotkeyManager.register({
    editor: "talk",
    name: "音声書き出し",
    callback: () => {
      /* noop */
    },
  });
});

it("unregisterできる", () => {
  const hotkeyManager = createHotkeyManager();
  const action = {
    editor: "talk",
    name: "音声書き出し",
    callback: vi.fn(),
  } as const;
  hotkeyManager.load([
    {
      action: "音声書き出し",
      combination: HotkeyCombination("1"),
    },
  ]);
  hotkeyManager.onEditorChange("talk");
  hotkeyManager.register(action);
  expect(hotkeyManager.getAllActions()).toStrictEqual([action]);

  hotkeyManager.unregister(action);
  expect(hotkeyManager.getAllActions()).toStrictEqual([]);
});

const callback = vi.fn();
const dummyAction: HotkeyAction = {
  editor: "talk",
  name: "音声書き出し",
  callback: callback,
};
const createDummySetting = (combination: string): HotkeySettingType => ({
  action: "音声書き出し",
  combination: HotkeyCombination(combination),
});

describe("設定変更", () => {
  let hotkeyManager: HotkeyManager;
  beforeEach(() => {
    const hotkeyManager_ = createHotkeyManager();
    hotkeyManager = hotkeyManager_;
    hotkeyManager.onEditorChange("talk");
    callback.mockClear();
  });

  it("設定を登録するとhotkeysが更新される", () => {
    hotkeyManager.register(dummyAction);
    hotkeyManager.load([createDummySetting("1")]);
    hotkeyManager.keyInput(createDummyInput("1", "Digit1") as KeyboardEvent);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("設定を更新するとhotkeysが更新される", () => {
    hotkeyManager.register(dummyAction);
    hotkeyManager.load([createDummySetting("1")]);
    hotkeyManager.replace(createDummySetting("A"));
    hotkeyManager.keyInput(createDummyInput("a", "KeyA") as KeyboardEvent);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("未割り当てにするとhotkeysから削除される", () => {
    hotkeyManager.register(dummyAction);
    hotkeyManager.load([createDummySetting("1")]);
    hotkeyManager.replace(createDummySetting(""));
    hotkeyManager.keyInput(createDummyInput("1", "Digit1") as KeyboardEvent);
    expect(callback).toHaveBeenCalledTimes(0);
  });

  it("未割り当てから割り当てるとhotkeysが更新される", () => {
    hotkeyManager.register(dummyAction);
    hotkeyManager.load([createDummySetting("")]);
    hotkeyManager.keyInput(createDummyInput("1", "Digit1") as KeyboardEvent);
    expect(callback).toHaveBeenCalledTimes(0);

    hotkeyManager.replace(createDummySetting("1"));
    hotkeyManager.keyInput(createDummyInput("1", "Digit1") as KeyboardEvent);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("割り当て -> 未割り当て -> 割り当てでhotkeysが更新される", () => {
    hotkeyManager.register(dummyAction);
    hotkeyManager.load([createDummySetting("1")]);

    hotkeyManager.keyInput(createDummyInput("1", "Digit1") as KeyboardEvent);
    expect(callback).toHaveBeenCalledTimes(1);

    hotkeyManager.replace(createDummySetting(""));
    hotkeyManager.keyInput(createDummyInput("1", "Digit1") as KeyboardEvent);
    expect(callback).toHaveBeenCalledTimes(1); // 呼び出し回数が増えない

    hotkeyManager.replace(createDummySetting("A"));
    hotkeyManager.keyInput(createDummyInput("a", "KeyA") as KeyboardEvent);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
