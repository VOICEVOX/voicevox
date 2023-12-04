import { v4 as uuidv4 } from "uuid";
import { defineStore, storeToRefs } from "pinia";

import { defineCommandableState } from "./pinia_command";
import { AudioKey } from "@/type/preload";
import { AudioItem, AudioState } from "@/store/type";

function generateAudioKey() {
  return AudioKey(uuidv4());
}

export type AudioCmdState = {
  audioItems: Record<AudioKey, AudioItem>;
  audioKeys: AudioKey[];
  audioStates: Record<AudioKey, AudioState>;
};

const audioCmdState = defineCommandableState({
  id: "audioStore/command/state",
  state: (): AudioCmdState => ({
    audioItems: {},
    audioKeys: [],
    audioStates: {},
  }),
});

export const audioStore = defineStore("audioStore/store", () => {
  const { state, asCmd, defCmd } = audioCmdState.useContext();

  const insertAudioItem = asCmd(
    (
      draft,
      {
        audioItem,
        audioKey,
        prevAudioKey,
      }: {
        audioItem: AudioItem;
        audioKey: AudioKey;
        prevAudioKey: AudioKey | undefined;
      }
    ) => {
      const index =
        prevAudioKey != undefined
          ? draft.audioKeys.indexOf(prevAudioKey) + 1
          : draft.audioKeys.length;
      draft.audioKeys.splice(index, 0, audioKey);
      draft.audioItems[audioKey] = audioItem;
      draft.audioStates[audioKey] = {
        nowGenerating: false,
      };
    }
  );

  const registerAudioItem = defCmd(
    insertAudioItem.func,
    (
      commit,
      {
        audioItem,
        prevAudioKey,
      }: { audioItem: AudioItem; prevAudioKey?: AudioKey }
    ) => {
      const audioKey = generateAudioKey();
      commit({ audioKey, audioItem, prevAudioKey });
      return audioKey;
    }
  );

  return {
    state: storeToRefs(state),
    insertAudioItem,
    registerAudioItem,
  };
});
