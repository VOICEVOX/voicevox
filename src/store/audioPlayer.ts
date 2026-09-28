/**
 * AudioContextによる音声再生・停止などを担当する。
 */
import { createPartialStore } from "./vuex";
import { createUILockAction } from "./ui";
import { ContinuousPlayer } from "./audioContinuousPlayer";
import type {
  AudioPlayerStoreState,
  AudioPlayerStoreTypes,
  CurrentPlayState,
} from "./type";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
import { ensureNotNullish } from "@/type/utility";
import { showAlertDialog } from "@/components/Dialog/Dialog";
import { AbortableMutex } from "@/helpers/abortableMutex";
import { createLogger } from "@/helpers/log";
import { WavStream } from "@/domain/wavStream";
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

/**
 * WavStreamを再生する。
 * 再生中にキャンセルされた場合、再生を中止する。
 *
 * # コールバック
 *
 * - `onStart()`: WavStreamの再生が開始されたときに呼ばれる。
 * - `onChunkStart(time: number)`: 新しいチャンクの再生が開始されたときに呼ばれる。
 *   - `time`: 再生中のWavStreamの再生時間（秒）。
 * - `onDelay()`: バッファが枯渇して再生が遅延したときに呼ばれる。
 */
export async function playAudioStream(
  {
    stream,
    offset,
    audioOutputDevice,
  }: {
    stream: WavStream;
    offset: number;
    audioOutputDevice: string;
  },
  cancel: AbortSignal,
  callbacks: {
    onStart?: () => void;
    onChunkStart?: (time: number) => void;
    onDelay?: () => void;
  } = {},
) {
  const samplesPerChunk = 256;

  if (!audioContext) {
    throw new Error("AudioContext is not supported in this browser.");
  }
  await setAudioContextSinkId(audioOutputDevice);
  // TODO: interruptedも考慮する
  if (audioContext.state === "suspended") {
    // NOTE: resumeできない場合はエラーが発生する（排他モードで専有中など）
    await audioContext.resume();
  }
  if (cancel.aborted) return;

  const { promise: cancelledPromise, resolve: resolveCancel } =
    Promise.withResolvers<typeof cancelledMarker>();
  using cancelables = new DisposableStack();
  const cancelledMarker = Symbol.for("cancelled");
  const onAbort = () => resolveCancel(cancelledMarker);
  cancel.addEventListener("abort", onAbort, { once: true });

  let lastBufferEndTime = audioContext.currentTime;

  const header = await Promise.race([cancelledPromise, stream.readHeader()]);
  if (header === cancelledMarker) return;
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

    if (chunkOrDone === cancelledMarker) {
      return;
    }
    if (chunkOrDone.done) {
      break;
    }

    const [leftSamples, rightSamples] = chunkOrDone.value;

    // 最初のチャンクの再生が開始されるときにonStartを呼ぶ
    if (numTotalSamples === 0) {
      callbacks.onStart?.();
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
      new DisposableTimeout((baseTime - audioContext.currentTime) * 1000, () =>
        callbacks.onChunkStart?.(currentSampleTime),
      ),
    );
    numTotalSamples += leftSamples.length;
    lastBufferEndTime = baseTime + audioBuffer.duration;
  }

  if (!cancel.aborted) {
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

const audioPlayMutex = new AbortableMutex();

export const audioPlayerStoreState: AudioPlayerStoreState = {
  currentPlayState: { type: "stopped" },
};

export const audioPlayerStore = createPartialStore<AudioPlayerStoreTypes>({
  ACTIVE_AUDIO_ELEM_CURRENT_TIME_GETTER: {
    getter: (state) => () =>
      state.currentPlayState.type === "playing"
        ? state.currentPlayState.currentTime
        : undefined,
  },

  NOW_PLAYING: {
    getter(state, getters) {
      return (
        state.currentPlayState.type === "playing" &&
        state.currentPlayState.audioKey === getters.ACTIVE_AUDIO_KEY
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

  PLAY_AUDIO: {
    action: createUILockAction(
      async ({ state, getters, mutations, actions }, { audioKey }) =>
        audioPlayMutex.lock(async (signal) => {
          if (signal.aborted) return false;
          const audioItem = cloneWithUnwrapProxy(state.audioItems[audioKey]);
          mutations.SET_AUDIO_NOW_GENERATING({
            audioKey,
            nowGenerating: true,
          });
          void actions.START_PROGRESS();
          try {
            const startTime = ensureNotNullish(
              (await actions.GET_AUDIO_PLAY_OFFSETS({ audioKey })).at(
                getters.AUDIO_PLAY_START_POINT ?? 0,
              ),
            );
            const { stream, startOffset } = await actions.FETCH_AUDIO_STREAM({
              audioItem,
              mode: "preview",
              startOffset: startTime,
              signal,
            });
            void actions.RESET_PROGRESS();
            mutations.SET_AUDIO_NOW_GENERATING({
              audioKey,
              nowGenerating: false,
            });
            return await actions.PLAY_AUDIO_STREAM({
              stream: new WavStream(stream),
              startOffset,
              audioKey,
              startTime,
              signal,
              notifyOnDelay:
                getters.IS_STREAMING_SYNTHESIS_SUPPORTED(audioItem),
            });
          } finally {
            void actions.RESET_PROGRESS();
            mutations.SET_AUDIO_NOW_GENERATING({
              audioKey,
              nowGenerating: false,
            });
          }
        }),
    ),
  },

  PLAY_CONTINUOUSLY_AUDIO: {
    action: createUILockAction(async ({ state, getters, mutations, actions }) =>
      audioPlayMutex.lock(async (signal) => {
        if (signal.aborted) return;
        const currentAudioKey = state._activeAudioKey;
        const currentAudioPlayStartPoint = getters.AUDIO_PLAY_START_POINT;
        const index =
          currentAudioKey == undefined
            ? 0
            : state.audioKeys.indexOf(currentAudioKey);
        const startTime =
          currentAudioKey == undefined
            ? 0
            : ensureNotNullish(
                (
                  await actions.GET_AUDIO_PLAY_OFFSETS({
                    audioKey: currentAudioKey,
                  })
                ).at(currentAudioPlayStartPoint ?? 0),
              );
        const audioKeys = state.audioKeys.slice(index);
        const player = new ContinuousPlayer(audioKeys, {
          async generateAudio({ audioKey }) {
            const result = await actions.FETCH_AUDIO_STREAM({
              audioItem: state.audioItems[audioKey],
              mode: "preview",
              signal,
              startOffset: audioKey === currentAudioKey ? startTime : 0,
            });
            return {
              stream: new WavStream(result.stream),
              startOffset: result.startOffset,
            };
          },
          playAudioStream({ audioKey, audio: { startOffset, stream } }) {
            if (currentAudioKey !== audioKey) {
              mutations.SET_AUDIO_PLAY_START_POINT({ startPoint: undefined });
            }
            void actions.RESET_PROGRESS();
            mutations.SET_AUDIO_NOW_GENERATING({
              audioKey,
              nowGenerating: false,
            });
            return actions.PLAY_AUDIO_STREAM({
              stream,
              startOffset,
              audioKey,
              signal,
              startTime: audioKey === currentAudioKey ? startTime : 0,
              notifyOnDelay: getters.IS_STREAMING_SYNTHESIS_SUPPORTED(
                state.audioItems[audioKey],
              ),
            });
          },
        });
        player.addEventListener("playstart", (event) => {
          mutations.SET_ACTIVE_AUDIO_KEY({ audioKey: event.audioKey });
        });
        player.addEventListener("waitstart", (event) => {
          void actions.START_PROGRESS();
          mutations.SET_ACTIVE_AUDIO_KEY({ audioKey: event.audioKey });
          mutations.SET_AUDIO_NOW_GENERATING({
            audioKey: event.audioKey,
            nowGenerating: true,
          });
        });

        mutations.SET_NOW_PLAYING_CONTINUOUSLY({ nowPlaying: true });
        try {
          await player.playUntilComplete();
        } finally {
          void actions.RESET_PROGRESS();
          for (const audioKey of audioKeys) {
            mutations.SET_AUDIO_NOW_GENERATING({
              audioKey,
              nowGenerating: false,
            });
          }
          mutations.SET_ACTIVE_AUDIO_KEY({ audioKey: currentAudioKey });
          mutations.SET_AUDIO_PLAY_START_POINT({
            startPoint: currentAudioPlayStartPoint,
          });
          mutations.SET_NOW_PLAYING_CONTINUOUSLY({ nowPlaying: false });
        }
      }),
    ),
  },

  STOP_AUDIO: {
    action() {
      return audioPlayMutex.abort();
    },
  },

  PLAY_AUDIO_STREAM: {
    async action(
      { state, mutations, actions },
      { stream, startOffset, audioKey, startTime, signal, notifyOnDelay },
    ) {
      try {
        if (signal.aborted) return false;
        let delayNotified = false;
        await playAudioStream(
          {
            stream,
            offset: startOffset,
            audioOutputDevice: state.savingSetting.audioOutputDevice,
          },
          signal,
          {
            onDelay() {
              if (
                notifyOnDelay &&
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
            onChunkStart(time) {
              mutations.SET_CURRENT_PLAY_STATE({
                currentPlayState: {
                  type: "playing",
                  audioKey,
                  currentTime: startTime + time,
                },
              });
            },
          },
        );
        return !signal.aborted;
      } finally {
        void stream.cancel().catch((error: unknown) => {
          if (!signal.aborted) log.error(error);
        });
        mutations.SET_CURRENT_PLAY_STATE({
          currentPlayState: { type: "stopped" },
        });
      }
    },
  },
});
