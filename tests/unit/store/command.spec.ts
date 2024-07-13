import { toRaw } from "vue";
import { store } from "@/store";
import { AudioKey } from "@/type/preload";

const initialState = structuredClone(toRaw(store.state));
beforeEach(() => {
  store.replaceState(initialState);
});

test("コマンド実行で履歴が作られる", async () => {
  await store.dispatch("COMMAND_SET_AUDIO_KEYS", {
    audioKeys: [AudioKey("00000000-0000-0000-0000-000000000000")],
  });

  // npm run test-watch:unit -- "tests\unit\store\command.spec.ts"
  // millisecをrandomUuidにし、かつrandomUuidをmockにする

  const { audioKeys, redoCommands, undoCommands } = store.state;
  expect({ audioKeys, redoCommands, undoCommands }).toMatchSnapshot();
});
