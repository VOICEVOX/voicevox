/**
 * HTMLAudioElement周りの音声再生・停止などを担当する。
 */
import { createPartialStore } from "./vuex";
import { AudioPlayerStoreState, AudioPlayerStoreTypes } from "./type";

export const audioPlayerStoreState: AudioPlayerStoreState = {
  //
};

export const audioPlayerStore = createPartialStore<AudioPlayerStoreTypes>({
  //
});
