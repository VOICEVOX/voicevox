/**
 * HTMLAudioElement・AudioContextによる音声再生・停止などを担当する。
 */
import { createPartialStore } from "./vuex";
import type {
  AudioPlayerStoreState,
  AudioPlayerStoreTypes,
  CurrentPlayState,
} from "./type";
import { type AudioUniqueId, generateUniqueIdAndQuery } from "./audioGenerate";
import { createUILockAction } from "./ui";
import type { AudioKey } from "@/type/preload";
import { showAlertDialog } from "@/components/Dialog/Dialog";
import { AbortableMutex } from "@/helpers/abortableMutex";
import { createLogger } from "@/helpers/log";
import { WavStream } from "@/domain/wavStream";
import { ensureNotNullish } from "@/type/utility";
import { LruCache } from "@/helpers/lruCache";
import { DisposableTimeout } from "@/helpers/disposableTimeout";

const log = createLogger("store/audioPlayer");
let audioContext: AudioContext | null = null;
if (window.AudioContext) {
  audioContext = new AudioContext();
}

async function setAudioContextSinkId(device: string) {
  if (!audioContext?.setSinkId) return;
  await audioContext
    .setSinkId(device === "default" ? "" : device)
    .catch((err: unknown) => {
      void showAlertDialog({
        title: "エラー",
        message: "再生デバイスが見つかりません",
      });
      throw err;
    });
}

const cancelled = Symbol("cancelled");

/**
 * ストリーミング再生用のキャッシュ。
 */
const audioCacheForStreaming = new LruCache<
  AudioUniqueId,
  {
    wav: Blob;
    startsAt: number;
  }
>(64);

/**
 * WavStreamの配列を順番に再生する。
 * 再生中にキャンセルされた場合、再生を中止する。
 *
 * # コールバック
 *
 * - `onStart(index: number)`: 新しいWavStreamの再生が開始されたときに呼ばれる。
 *   - `index`: 再生中のWavStreamのインデックス。
 * - `onChunkStart(index: number, time: number)`: 新しいチャンクの再生が開始されたときに呼ばれる。
 *   - `index`: 再生中のWavStreamのインデックス。
 *   - `time`: 再生中のWavStreamの再生時間（秒）。
 * - `onDelay()`: バッファが枯渇して再生が遅延したときに呼ばれる。
 * - `onStreamEnd(index: number)`: WavStreamの全てのチャンクが読み込まれたときに呼ばれる。
 *   - `index`: 再生中のWavStreamのインデックス。
 */
export async function playAudioStreams(
  audioStreams: {
    /** WAVの先頭からの再生開始位置（秒）。 */
    offset: number;
    stream: WavStream;
  }[],
  cancel: AbortSignal,
  callbacks: {
    onStart?: (index: number) => void;
    onChunkStart?: (index: number, time: number) => void;
    onDelay?: () => void;
    onStreamEnd?: (index: number) => void | Promise<void>;
  } = {},
) {
  const samplesPerChunk = 256;

  if (!audioContext) {
    throw new Error("AudioContext is not supported in this browser.");
  }
  // TODO: interruptedも考慮する
  if (audioContext.state === "suspended") {
    // NOTE: resumeできない場合はエラーが発生する（排他モードで専有中など）
    await audioContext.resume();
  }
  if (cancel.aborted) return;

  const bufferSources: AudioBufferSourceNode[] = [];
  const { promise: cancelledPromise, resolve: resolveCancel } =
    Promise.withResolvers<typeof cancelled>();
  cancel.addEventListener("abort", () => {
    resolveCancel(cancelled);
  });
  let lastBufferEndTime = audioContext.currentTime;

  using cancelables = new DisposableStack();
  for (const [index, { offset, stream }] of audioStreams.entries()) {
    const header = await Promise.race([cancelledPromise, stream.readHeader()]);
    if (header === cancelled) return;
    const sampleRate = header.sampleRate;

    const samplesIterator = stream.readSamples(
      samplesPerChunk,
      Math.floor(offset * sampleRate),
    );
    let numTotalSamples = 0;
    while (true) {
      // 現在のバッファの終了時刻に向けて遅延通知をセットする
      // ただし、初回のチャンクは再生開始前なので遅延通知をセットしない
      using delayNotifier =
        numTotalSamples > 0
          ? new DisposableTimeout(
              (lastBufferEndTime - audioContext.currentTime) * 1000,
              () => callbacks.onDelay?.(),
            )
          : undefined;

      // 中断されるか、次のチャンクが読み込まれるまで待つ
      const chunkOrDone = await Promise.race([
        cancelledPromise,
        samplesIterator.next(),
      ]);
      delayNotifier?.clear();

      if (chunkOrDone === cancelled) {
        return;
      }
      if (chunkOrDone.done) {
        break;
      }

      const [leftSamples, rightSamples] = chunkOrDone.value;

      // 最初のチャンクの再生が開始されるときにonStartを呼ぶ
      if (numTotalSamples === 0) {
        callbacks.onStart?.(index);
      }

      // AudioBufferを作ってチャンクのサンプルをコピーする
      const audioBuffer = audioContext.createBuffer(
        2,
        leftSamples.length,
        sampleRate,
      );
      const leftChannel = audioBuffer.getChannelData(0);
      const rightChannel = audioBuffer.getChannelData(1);
      leftChannel.set(leftSamples);
      rightChannel.set(rightSamples);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      cancelables.use({
        [Symbol.dispose]() {
          source.disconnect();
          source.stop();
        },
      });

      // 現在のバッファの終了時刻に合わせて再生を予約する
      // ただし現在のバッファがすでに終了している場合は現在時刻で再生を予約する（=今すぐ再生する）
      const baseTime = Math.max(lastBufferEndTime, audioContext.currentTime);
      source.start(baseTime);

      // 予約した再生時刻に合わせてonChunkStartを呼ぶ
      const currentSampleTime = numTotalSamples / sampleRate;
      cancelables.use(
        new DisposableTimeout(
          (baseTime - audioContext.currentTime) * 1000,
          () => callbacks.onChunkStart?.(index, currentSampleTime),
        ),
      );
      numTotalSamples += leftSamples.length;
      lastBufferEndTime = baseTime + audioBuffer.duration;
      bufferSources.push(source);
    }

    if (!cancel.aborted) {
      await callbacks.onStreamEnd?.(index);

      // 最後のチャンクの再生が終了するか、中断されるまで待つ
      const { promise: playbackEnded, resolve: resolvePlaybackEnd } =
        Promise.withResolvers<void>();
      using _playbackEndNotifier = new DisposableTimeout(
        (lastBufferEndTime - audioContext.currentTime) * 1000,
        resolvePlaybackEnd,
      );
      await Promise.race([playbackEnded, cancelledPromise]);
    }
  }
}

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

const audioPlayMutex = new AbortableMutex();

export const audioPlayerStoreState: AudioPlayerStoreState = {
  currentPlayState: { type: "stopped" },
};

export const audioPlayerStore = createPartialStore<AudioPlayerStoreTypes>({
  ACTIVE_AUDIO_ELEM_CURRENT_TIME_GETTER: {
    getter: (state) => () => {
      if (state.currentPlayState.type === "playing") {
        return getAudioElement().currentTime;
      } else if (state.currentPlayState.type === "streaming") {
        return state.currentPlayState.currentTime;
      } else {
        return undefined;
      }
    },
  },

  NOW_PLAYING: {
    getter(state, getters) {
      const activeAudioKey = getters.ACTIVE_AUDIO_KEY;
      return (
        state.currentPlayState.type !== "stopped" &&
        state.currentPlayState.audioKey === activeAudioKey
      );
    },
  },

  SET_CURRENT_PLAY_STATE: {
    mutation(
      state,
      { currentPlayState }: { currentPlayState: CurrentPlayState },
    ) {
      state.currentPlayState = currentPlayState;
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
          mutations.SET_CURRENT_PLAY_STATE({
            currentPlayState: {
              type: "playing",
              audioKey,
            },
          });
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
          mutations.SET_CURRENT_PLAY_STATE({
            currentPlayState: {
              type: "stopped",
            },
          });
        }
      });

      void audioElement.play();

      return audioPlayPromise;
    },
  },

  STOP_AUDIO: {
    // 停止中でも呼び出して問題ない
    action() {
      getAudioElement().pause();
      return audioPlayMutex.abort();
    },
  },

  PLAY_AUDIO_STREAMING: {
    action: createUILockAction(
      async (
        { state, getters, actions },
        { audioKey }: { audioKey: AudioKey },
      ) => {
        const engineId = state.audioItems[audioKey].voice.engineId;
        const engineManifest = state.engineManifests[engineId];
        if (!engineManifest.supportedFeatures?.streamingSynthesis) {
          throw new Error("Streaming synthesis is not supported.");
        }
        const audioItem = state.audioItems[audioKey];
        const { id, engineAudioQuery: audioQuery } =
          await generateUniqueIdAndQuery(state, audioItem);
        const accentPhraseOffsets = await actions.GET_AUDIO_PLAY_OFFSETS({
          audioKey,
        });
        const startTime =
          accentPhraseOffsets[getters.AUDIO_PLAY_START_POINT ?? 0];

        // # キャッシュについて
        //
        // - AudioQueryやstyleIdなどの音声を生成するためのパラメーターから生成されるIDをキャッシュのキーにする。
        // - 音声をすべて取得しきったあとにキャッシュにいれる。
        //   - そのため、キャッシュには`(キャッシュのキー) -> (開始時刻, 開始時刻から終端までの音声)`、しか入らない。
        // - もしキャッシュが存在していて、再生しようとしている時刻からの音声を含んでいる場合は、キャッシュから再生する。
        //   - ここで、「再生しようとしている時刻からの音声を含んでいる場合」はキャッシュの開始時刻が再生しようとしている時刻よりも前かどうかで判定する。
        const existingCache = audioCacheForStreaming.get(id);
        if (existingCache && existingCache.startsAt <= startTime) {
          log.info(
            `Using cached audio for ${audioKey} starting at ${existingCache.startsAt} with offset ${startTime - existingCache.startsAt}`,
          );
          return await actions.PLAY_AUDIO_STREAMING_FROM_CACHE({
            audioKey,
            cache: existingCache,
            startTime,
          });
        } else {
          log.info(`Generating audio for ${audioKey} starting at ${startTime}`);

          return await actions.GENERATE_AND_PLAY_AUDIO_STREAMING({
            audioKey,
            audioItem,
            audioQuery,
            cacheKey: id,
            startTime,
          });
        }
      },
    ),
  },

  PLAY_AUDIO_STREAMING_FROM_CACHE: {
    async action({ state, mutations }, { audioKey, cache, startTime }) {
      getAudioElement().pause();
      return await audioPlayMutex.lock(async (abortSignal) => {
        if (abortSignal.aborted) return false;
        using cleanup = new DisposableStack();
        cleanup.defer(() => {
          mutations.SET_CURRENT_PLAY_STATE({
            currentPlayState: { type: "stopped" },
          });
        });
        await setAudioContextSinkId(state.savingSetting.audioOutputDevice);
        if (abortSignal.aborted) return false;
        const wavBlob = cache.wav;
        const wavStreamForPlay = new WavStream(wavBlob.stream());

        await playAudioStreams(
          [
            {
              offset: startTime - cache.startsAt,
              stream: wavStreamForPlay,
            },
          ],
          abortSignal,
          {
            onChunkStart(_index, time) {
              mutations.SET_CURRENT_PLAY_STATE({
                currentPlayState: {
                  type: "streaming",
                  audioKey,
                  currentTime: time + startTime,
                },
              });
            },
          },
        );
        return !abortSignal.aborted;
      });
    },
  },

  GENERATE_AND_PLAY_AUDIO_STREAMING: {
    async action(
      { state, mutations, actions },
      { audioKey, audioItem, audioQuery, cacheKey, startTime },
    ) {
      getAudioElement().pause();

      const segmentLength = {
        LOW_LATENCY: 0.3,
        BALANCED: 1.0,
        STABLE: 9999,
      }[state.streamingMode];
      return await audioPlayMutex.lock(async (abortSignal) => {
        using cleanup = new DisposableStack();
        cleanup.defer(() => {
          void actions.RESET_PROGRESS();
          mutations.SET_AUDIO_NOW_GENERATING({
            audioKey,
            nowGenerating: false,
          });
          mutations.SET_CURRENT_PLAY_STATE({
            currentPlayState: { type: "stopped" },
          });
        });
        await setAudioContextSinkId(state.savingSetting.audioOutputDevice);
        if (abortSignal.aborted) return false;
        mutations.SET_AUDIO_NOW_GENERATING({
          audioKey,
          nowGenerating: true,
        });
        void actions.START_PROGRESS();
        const instance = await actions.INSTANTIATE_ENGINE_CONNECTOR({
          engineId: audioItem.voice.engineId,
        });
        const response = await instance.invoke("streamingSynthesisRaw")(
          {
            audioQuery,
            speaker: audioItem.voice.styleId,
            enableInterrogativeUpspeak:
              state.experimentalSetting.enableInterrogativeUpspeak,
            startOffset: startTime,
            segmentLength,
          },
          { signal: abortSignal },
        );

        const wavBody = ensureNotNullish(response.raw.body);
        const [wavBodyForPlay, wavBodyForSave] = wavBody.tee();

        const wavStream = new WavStream(wavBodyForPlay);
        let delayNotified = false;
        await playAudioStreams(
          [{ offset: 0, stream: wavStream }],
          abortSignal,
          {
            onStart() {
              void actions.RESET_PROGRESS();
              // TODO: GENERATING（生成）自体は終わっていないので、generatingという名称を変更する
              mutations.SET_AUDIO_NOW_GENERATING({
                audioKey,
                nowGenerating: false,
              });
            },
            onChunkStart(_index, time) {
              mutations.SET_CURRENT_PLAY_STATE({
                currentPlayState: {
                  type: "streaming",
                  audioKey,
                  currentTime: time + startTime,
                },
              });
            },
            onDelay() {
              if (
                !delayNotified &&
                !state.confirmedTips.streamingUnrecommended
              ) {
                delayNotified = true;

                void actions.SHOW_NOTIFY_AND_NOT_SHOW_AGAIN_BUTTON({
                  message:
                    "音声が途切れる場合は設定の「ストリーミング再生」を「安定」に変更してください",
                  icon: "warning",
                  tipName: "streamingUnrecommended",
                });
              }
            },
            async onStreamEnd() {
              log.info(
                `Caching audio for ${audioKey} starting at ${startTime}`,
              );
              const wavBlob = await new Response(wavBodyForSave).blob();
              audioCacheForStreaming.set(cacheKey, {
                wav: wavBlob,
                startsAt: startTime,
              });
            },
          },
        );
        return !abortSignal.aborted;
      });
    },
  },
});
