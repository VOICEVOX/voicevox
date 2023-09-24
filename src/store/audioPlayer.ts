/**
 * HTMLAudioElement周りの音声再生・停止などを担当する。
 */
import { createPartialStore } from "./vuex";
import { AudioPlayerStoreState, AudioPlayerStoreTypes } from "./type";

// ユニットテストが落ちるのを回避するための遅延読み込み
const getAudioElement = (() => {
  let audioElement: HTMLAudioElement | undefined = undefined;
  return () => {
    if (audioElement == undefined) {
      audioElement = new Audio();
    }
    return audioElement;
  };
})();

export const audioPlayerStoreState: AudioPlayerStoreState = {
  //
};

export const audioPlayerStore = createPartialStore<AudioPlayerStoreTypes>({
  //

  // NOTE: リファクタリング中、別ファイルに移動予定
  SET_AUDIO_SOURCE: {
    mutation(_, { audioBlob }: { audioBlob: Blob }) {
      getAudioElement().src = URL.createObjectURL(audioBlob);
    },
  },
});
