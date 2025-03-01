import { store } from "@/store/index.ts";
import { AudioKey } from "@/type/preload.ts";
import { resetMockMode, uuid4 } from "@/helpers/random.ts";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy.ts";

const initialState = cloneWithUnwrapProxy(store.state);
beforeEach(() => {
  store.replaceState(initialState);

  resetMockMode();
});

test("コマンド実行で履歴が作られる", async () => {
  await store.dispatch("COMMAND_SET_AUDIO_KEYS", {
    audioKeys: [AudioKey(uuid4())],
  });
  const { audioKeys, redoCommands, undoCommands } = store.state;
  expect({ audioKeys, redoCommands, undoCommands }).toMatchSnapshot();
});
