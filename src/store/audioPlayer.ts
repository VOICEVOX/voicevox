import { createPartialStore } from "./vuex";
import { AudioPlayerStoreState, AudioPlayerStoreTypes } from "./type";
import { AudioKey } from "@/type/preload";

export const audioPlayerStoreState: AudioPlayerStoreState = {
  nowPlayingAudioKeys: [],
  nowPlayingContinuouslyAudioKey: undefined,
};

// AudioKey 毎に一つ
const audioElements: Map<AudioKey, HTMLAudioElement> = new Map();

export const audioPlayerStore = createPartialStore<AudioPlayerStoreTypes>({
  AUDIO_CURRENT_TIME: {
    getter: (state) => (audioKey: AudioKey) =>
      state.nowPlayingAudioKeys.includes(audioKey)
        ? audioElements.get(audioKey)?.currentTime ?? undefined
        : undefined,
  },

  NOW_PLAYING_CONTINUOUSLY: {
    getter(state) {
      return state.nowPlayingContinuouslyAudioKey !== undefined;
    },
  },

  LOAD_AUDIO_PLAYER: {
    action(_, { audioKey, blob }: { audioKey: AudioKey; blob: Blob }) {
      let audioElement = audioElements.get(audioKey);
      if (audioElement === undefined) {
        audioElement = new Audio();
      }
      audioElement.pause();
      audioElement.src = URL.createObjectURL(blob);
      audioElements.set(audioKey, audioElement);
    },
  },

  UNLOAD_AUDIO_PLAYER: {
    action({ dispatch }, { audioKey }: { audioKey?: AudioKey }) {
      let audioElement;
      if (
        audioKey === undefined ||
        (audioElement = audioElements.get(audioKey)) === undefined
      ) {
        return;
      }
      dispatch("STOP_AUDIO", { audioKey });
      audioElement.removeAttribute("src");
      audioElements.delete(audioKey);
    },
  },

  PLAY_AUDIO: {
    mutation(state, { audioKey }: { audioKey: AudioKey }) {
      state.nowPlayingAudioKeys.push(audioKey);
    },
    async action(
      { state, dispatch, commit },
      { audioKey, offset }: { audioKey: AudioKey; offset?: number }
    ) {
      const audioElem = audioElements.get(audioKey);
      if (audioElem === undefined)
        throw new Error(
          "音声の読み込み前に再生されようとしました。先に LOAD_AUDIO_PLAYER を行ってください。"
        );

      if (offset !== undefined) {
        // 小さい値が切り捨てられることでフォーカスされるアクセントフレーズが一瞬元に戻るので、
        // 再生に影響のない程度かつ切り捨てられない値を加算する
        audioElem.currentTime = offset + 10e-6;
      }

      // 一部ブラウザではsetSinkIdが実装されていないので、その環境では無視する
      if (audioElem.setSinkId) {
        audioElem
          .setSinkId(state.savingSetting.audioOutputDevice)
          .catch((err) => {
            const stop = () => {
              audioElem.pause();
              audioElem.removeEventListener("canplay", stop);
            };
            audioElem.addEventListener("canplay", stop);
            dispatch("SHOW_ALERT_DIALOG", {
              title: "再生エラー",
              message:
                "再生デバイスが見つかりませんでした。設定 / オプション から再生デバイスを設定しなおしてみてください。",
            });
            throw new Error(err);
          });
      }

      // 再生終了時にresolveされるPromiseを返す
      const played = async () => {
        commit("PLAY_AUDIO", { audioKey });
      };
      audioElem.addEventListener("play", played);

      let paused: () => void;
      const audioPlayPromise = new Promise<boolean>((resolve) => {
        paused = () => {
          resolve(audioElem.ended);
        };
        audioElem.addEventListener("pause", paused);
      }).finally(async () => {
        audioElem.removeEventListener("play", played);
        audioElem.removeEventListener("pause", paused);
        if (audioKey) {
          commit("STOP_AUDIO", { audioKey });
        }
      });

      audioElem.play();

      return audioPlayPromise;
    },
  },

  STOP_AUDIO: {
    mutation(state, { audioKey }: { audioKey: AudioKey }) {
      const audioKeys = state.nowPlayingAudioKeys;
      if (audioKeys.includes(audioKey)) {
        delete audioKeys[audioKeys.indexOf(audioKey)];
      }
    },
    action({ commit }, { audioKey }: { audioKey: AudioKey }) {
      const audioElem = audioElements.get(audioKey);
      if (audioElem === undefined) throw new Error("audioElem === undefined");
      audioElem.pause();
      commit("STOP_AUDIO", { audioKey });
    },
  },

  PLAY_ALONG_PLAYLIST: {
    mutation(state, { audioKey }: { audioKey: AudioKey }) {
      state.nowPlayingContinuouslyAudioKey = audioKey;
    },
    async action({ commit, dispatch }, { audioKeys }) {
      const offset = 0;
      try {
        for await (const audioKey of audioKeys) {
          commit("PLAY_ALONG_PLAYLIST", { audioKey });
          const isEnded = await dispatch("PLAY_AUDIO", { audioKey, offset });
          if (!isEnded) {
            break;
          }
        }
      } finally {
        commit("STOP_PLAYLIST");
      }
    },
  },

  STOP_PLAYLIST: {
    mutation(state) {
      state.nowPlayingContinuouslyAudioKey = undefined;
    },
    action({ state, commit, dispatch }) {
      const audioKey = state.nowPlayingContinuouslyAudioKey;
      if (audioKey !== undefined) {
        dispatch("STOP_AUDIO", { audioKey });
      }
      commit("STOP_PLAYLIST");
    },
  },
});
