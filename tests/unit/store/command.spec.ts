import { toRaw } from "vue";
import { store } from "@/store";
import { AudioKey } from "@/type/preload";
import { resetMockMode, uuid4 } from "@/helpers/random";

const initialState = structuredClone(toRaw(store.state));
beforeEach(() => {
  store.replaceState(initialState);

  resetMockMode();
});

test("コマンド実行で履歴が作られる", async () => {
  await store.dispatch("COMMAND_SET_AUDIO_KEYS", {
    audioKeys: [AudioKey(uuid4())],
  });

  // npm run test-watch:unit -- "tests\unit\store\command.spec.ts"
  // millisecをrandomUuidにし、かつrandomUuidをmockにする

  const { audioKeys, redoCommands, undoCommands } = store.state;
  expect({ audioKeys, redoCommands, undoCommands }).toMatchSnapshot();
});
