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
  const { defMut, defCmd, asNonRecordAct, _rawStore } =
    audioCmdState.useControllerContext();

  const mutInsertAudioItem = defMut(
    (
      { state },
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
          ? state.audioKeys.indexOf(prevAudioKey) + 1
          : state.audioKeys.length;
      state.audioKeys.splice(index, 0, audioKey);
      state.audioItems[audioKey] = audioItem;
      state.audioStates[audioKey] = {
        nowGenerating: false,
      };
    }
  );
  const cmdRegisterAudioItem = defCmd(
    (
      { recordCommit },
      {
        audioItem,
        prevAudioKey,
      }: { audioItem: AudioItem; prevAudioKey?: AudioKey }
    ) => {
      const audioKey = generateAudioKey();
      recordCommit(mutInsertAudioItem, { audioKey, audioItem, prevAudioKey });
      return audioKey;
    }
  );
  const actRegisterAudioItem = asNonRecordAct(cmdRegisterAudioItem);

  const mutRemoveAudioItem = defMut(
    ({ state }, { audioKey }: { audioKey: AudioKey }) => {
      state.audioKeys.splice(state.audioKeys.indexOf(audioKey), 1);
      delete state.audioItems[audioKey];
      delete state.audioStates[audioKey];
    }
  );
  const mutMultiRemoveAudioItem = defMut(
    ({ commit }, { audioKeys }: { audioKeys: AudioKey[] }) => {
      for (const audioKey of audioKeys) {
        commit(mutRemoveAudioItem, { audioKey });
      }
    }
  );
  const cmdMultiRemoveAudioItem = defCmd(
    ({ recordCommit }, payload: { audioKeys: AudioKey[] }) =>
      recordCommit(mutMultiRemoveAudioItem, payload)
  );

  return {
    state: storeToRefs(_rawStore),
    cmdRegisterAudioItem,
    actRegisterAudioItem,
    cmdMultiRemoveAudioItem,
  };
});
