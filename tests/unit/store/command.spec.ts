import { beforeEach, describe, expect, test } from "vitest";
import { store } from "@/store";
import { findNearestRemainingAudioKey } from "@/store/command";
import { AudioKey } from "@/type/preload";
import { resetMockMode, uuid4 } from "@/helpers/random";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";

const initialState = cloneWithUnwrapProxy(store.state);
beforeEach(() => {
  store.replaceState(cloneWithUnwrapProxy(initialState));

  resetMockMode();
});

test("コマンド実行で履歴が作られる", async () => {
  await store.actions.COMMAND_SET_AUDIO_KEYS({
    audioKeys: [AudioKey(uuid4())],
  });
  const { audioKeys, redoCommands, undoCommands } = store.state;
  expect({ audioKeys, redoCommands, undoCommands }).toMatchSnapshot();
});

describe("findNearestRemainingAudioKey", () => {
  const a = AudioKey(uuid4());
  const b = AudioKey(uuid4());
  const c = AudioKey(uuid4());
  const d = AudioKey(uuid4());

  test("上のテキスト欄が残っていれば、それを選ぶ", () => {
    expect(findNearestRemainingAudioKey([a, b, c], c, [a, b])).toBe(b);
    expect(findNearestRemainingAudioKey([a, b, c, d], c, [a, d])).toBe(a);
  });

  test("上に残っていなければ、下のテキスト欄を選ぶ", () => {
    expect(findNearestRemainingAudioKey([a, b, c], a, [b, c])).toBe(b);
    expect(findNearestRemainingAudioKey([a, b, c, d], b, [d])).toBe(d);
  });

  test("消えたテキスト欄が前の一覧にもなければ、先頭を選ぶ", () => {
    expect(findNearestRemainingAudioKey([a, b], c, [a, b])).toBe(a);
  });

  test("残っているテキスト欄がなければ undefined", () => {
    expect(findNearestRemainingAudioKey([a], a, [])).toBeUndefined();
  });
});

test("Undoでアクティブなテキスト欄が消えたら、近くのテキスト欄がアクティブになる", async () => {
  const a = AudioKey(uuid4());
  const b = AudioKey(uuid4());
  const c = AudioKey(uuid4());
  await store.actions.COMMAND_SET_AUDIO_KEYS({ audioKeys: [a, b] });
  await store.actions.COMMAND_SET_AUDIO_KEYS({ audioKeys: [a, b, c] });
  await store.actions.SET_ACTIVE_AUDIO_KEY({ audioKey: c });
  await store.actions.SET_SELECTED_AUDIO_KEYS({ audioKeys: [c] });

  await store.actions.UNDO({ editor: "talk" });

  expect(store.state.audioKeys).toEqual([a, b]);
  expect(store.getters.ACTIVE_AUDIO_KEY).toBe(b);
  expect(store.getters.SELECTED_AUDIO_KEYS).toEqual([b]);
});

test("Undoでアクティブなテキスト欄が残っていれば、アクティブは変わらない", async () => {
  const a = AudioKey(uuid4());
  const b = AudioKey(uuid4());
  const c = AudioKey(uuid4());
  await store.actions.COMMAND_SET_AUDIO_KEYS({ audioKeys: [a, b] });
  await store.actions.COMMAND_SET_AUDIO_KEYS({ audioKeys: [a, b, c] });
  await store.actions.SET_ACTIVE_AUDIO_KEY({ audioKey: a });

  await store.actions.UNDO({ editor: "talk" });

  expect(store.getters.ACTIVE_AUDIO_KEY).toBe(a);
});
