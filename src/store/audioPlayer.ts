/**
 * HTMLAudioElement周りの音声再生・停止などを担当する。
 */
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
  CALC_AUDIO_CURRENT_TIME: {
    getter: () => (audioKey: AudioKey) => {
      const audioElement = audioElements.get(audioKey);
      if (audioElement === undefined)
        throw new Error("audioElement === undefined");
      return audioElement.currentTime;
    },
  },

  IS_PLAYING_CONTINUOUSLY: {
    getter(state) {
      return state.nowPlayingContinuouslyAudioKey !== undefined;
    },
  },

  /**
   * 音声blobをセットする。また、必要ならセット前にAudioインスタンスを作成して`audioElements`へ登録する。
   */
  PREPARE_AUDIO_PLAYER: {
    action(_, { audioKey, blob }: { audioKey: AudioKey; blob: Blob }) {
      let audioElement = audioElements.get(audioKey);
      if (audioElement === undefined) {
        audioElement = new Audio();
        audioElements.set(audioKey, audioElement);
      }
      audioElement.pause();
      audioElement.src = URL.createObjectURL(blob);
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
          "音声の読み込み前に再生されようとしました。先に PREPARE_AUDIO_PLAYER を行ってください。"
        );

      if (offset !== undefined) {
        audioElem.currentTime = offset;
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
        commit("STOP_AUDIO", { nowPlayingAudioKey: audioKey });
      });

      audioElem.play();

      return audioPlayPromise;
    },
  },

  STOP_AUDIO: {
    mutation(state, { nowPlayingAudioKey }: { nowPlayingAudioKey: AudioKey }) {
      const audioKeys = state.nowPlayingAudioKeys;
      if (audioKeys.includes(nowPlayingAudioKey)) {
        delete audioKeys[audioKeys.indexOf(nowPlayingAudioKey)];
      } else {
        // もしかするとユーザー操作と自動停止が同時に実行されるかもしれないので警告出力に留めておく
        console.warn("再生中でないオーディオが停止されようとしました。");
      }
    },
    action(_, { nowPlayingAudioKey }: { nowPlayingAudioKey: AudioKey }) {
      const audioElem = audioElements.get(nowPlayingAudioKey);
      if (audioElem === undefined) throw new Error("audioElem === undefined");
      audioElem.pause();
      // PLAY_AUDIO 時に"pause"イベントでcommitされるよう登録してあるため追加で何かする必要はない
    },
  },

  PLAY_AUDIOS: {
    mutation(state, { audioKey }: { audioKey: AudioKey }) {
      state.nowPlayingContinuouslyAudioKey = audioKey;
    },
    async action(
      { commit, dispatch },
      {
        audioKeys,
        beforePlayFn,
      }: {
        audioKeys: AudioKey[];
        beforePlayFn: (audioKey: AudioKey) => Promise<void>;
      }
    ) {
      const offset = 0;
      try {
        for (const audioKey of audioKeys) {
          await beforePlayFn(audioKey);
          commit("PLAY_AUDIOS", { audioKey });
          const isEnded = await dispatch("PLAY_AUDIO", { audioKey, offset });
          if (!isEnded) {
            break;
          }
        }
      } finally {
        commit("STOP_AUDIOS");
      }
    },
  },

  STOP_AUDIOS: {
    mutation(state) {
      state.nowPlayingContinuouslyAudioKey = undefined;
    },
    action({ state, commit, dispatch }) {
      const nowPlayingAudioKey = state.nowPlayingContinuouslyAudioKey;
      if (nowPlayingAudioKey !== undefined) {
        dispatch("STOP_AUDIO", { nowPlayingAudioKey });
      }
      commit("STOP_AUDIOS");
    },
  },
});
