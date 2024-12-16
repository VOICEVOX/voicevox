/**
 * HTMLAudioElement周りの音声再生・停止などを担当する。
 */
import { createPartialStore } from "./vuex";
import { AudioPlayerStoreState, AudioPlayerStoreTypes } from "./type";
import { AudioKey } from "@/type/preload";
import { showAlertDialog } from "@/components/Dialog/Dialog";

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
  nowPlayingAudioKey: undefined,
};

export const audioPlayerStore = createPartialStore<AudioPlayerStoreTypes>({
  ACTIVE_AUDIO_ELEM_CURRENT_TIME: {
    getter: (state) => {
      return state._activeAudioKey != undefined
        ? getAudioElement().currentTime
        : undefined;
    },
  },

  NOW_PLAYING: {
    getter(state, getters) {
      const activeAudioKey = getters.ACTIVE_AUDIO_KEY;
      return (
        activeAudioKey != undefined &&
        activeAudioKey === state.nowPlayingAudioKey
      );
    },
  },

  SET_AUDIO_NOW_PLAYING: {
    mutation(
      state,
      { audioKey, nowPlaying }: { audioKey: AudioKey; nowPlaying: boolean },
    ) {
      state.nowPlayingAudioKey = nowPlaying ? audioKey : undefined;
    },
  },

  SET_AUDIO_SOURCE: {
    mutation(_, { audioBlob }: { audioBlob: Blob }) {
      getAudioElement().src = URL.createObjectURL(audioBlob);
    },
  },

  PLAY_AUDIO_PLAYER: {
    async action(
      { state, mutations },
      { offset, audioKey }: { offset?: number; audioKey?: AudioKey },
    ) {
      const audioElement = getAudioElement();

      if (offset != undefined) {
        audioElement.currentTime = offset;
      }

      // 一部ブラウザではsetSinkIdが実装されていないので、その環境では無視する
      if (audioElement.setSinkId) {
        audioElement
          .setSinkId(state.savingSetting.audioOutputDevice)
          .catch((err: unknown) => {
            const stop = () => {
              audioElement.pause();
              audioElement.removeEventListener("canplay", stop);
            };
            audioElement.addEventListener("canplay", stop);
            void showAlertDialog({
              title: "エラー",
              message: "再生デバイスが見つかりません",
            });
            throw err;
          });
      }

      // 再生終了時にresolveされるPromiseを返す
      const played = async () => {
        if (audioKey) {
          mutations.SET_AUDIO_NOW_PLAYING({ audioKey, nowPlaying: true });
        }
      };
      audioElement.addEventListener("play", played);

      let paused: () => void;
      const audioPlayPromise = new Promise<boolean>((resolve) => {
        paused = () => {
          resolve(audioElement.ended);
        };
        audioElement.addEventListener("pause", paused);
      }).finally(async () => {
        audioElement.removeEventListener("play", played);
        audioElement.removeEventListener("pause", paused);
        if (audioKey) {
          mutations.SET_AUDIO_NOW_PLAYING({ audioKey, nowPlaying: false });
        }
      });

      void audioElement.play();

      return audioPlayPromise;
    },
  },

  STOP_AUDIO: {
    // 停止中でも呼び出して問題ない
    action() {
      // PLAY_ でonpause時の処理が設定されているため、pauseするだけで良い
      getAudioElement().pause();
    },
  },
});
