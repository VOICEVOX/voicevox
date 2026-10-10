/**
 * AudioContextによる音声再生・停止などを担当する。
 */
import { createPartialStore } from "./vuex";
import { createUILockAction } from "./ui";
import { playContinuously } from "./audioContinuousPlayer";
import { audioContext } from "./audioContext";
import type {
  AudioPlayerStoreState,
  AudioPlayerStoreTypes,
  CurrentPlayState,
} from "./type";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
import { ensureNotNullish } from "@/type/utility";
import { AbortableMutex } from "@/helpers/abortableMutex";
import { WavStream } from "@/domain/wavStream";
import { DisposableTimeout } from "@/helpers/disposableTimeout";

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
  stream: WavStream,
  streamOffset: number,
  cancel: AbortSignal,
  callbacks: {
    onStart?: () => void;
    onChunkStart?: (time: number) => void;
    onDelay?: () => void;
  } = {},
) {
  const samplesPerChunk = 256;

  if (cancel.aborted) return;
  const context = audioContext();

  const { promise: cancelledPromise, resolve: resolveCancel } =
    Promise.withResolvers<typeof cancelledMarker>();
  using cancelables = new DisposableStack();
  const cancelledMarker = Symbol.for("cancelled");
  const onAbort = () => resolveCancel(cancelledMarker);
  cancel.addEventListener("abort", onAbort, { once: true });

  let lastBufferEndTime = context.currentTime;

  const header = await Promise.race([cancelledPromise, stream.readHeader()]);
  if (header === cancelledMarker) return;
  const sampleRate = header.sampleRate;

  const samplesIterator = stream.readSamples(
    samplesPerChunk,
    Math.floor(streamOffset * sampleRate),
  );
  let numTotalSamples = 0;
  while (true) {
    // 現在のバッファの終了時刻に向けて遅延通知をセットする
    // ただし、初回のチャンクは再生開始前なので遅延通知をセットしない
    using delayNotifier =
      numTotalSamples > 0
        ? new DisposableTimeout(
            (lastBufferEndTime - context.currentTime) * 1000,
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
    const audioBuffer = context.createBuffer(2, leftSamples.length, sampleRate);
    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = audioBuffer.getChannelData(1);
    leftChannel.set(leftSamples);
    rightChannel.set(rightSamples);

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    cancelables.use({
      [Symbol.dispose]() {
        source.disconnect();
        source.stop();
      },
    });

    // 現在のバッファの終了時刻に合わせて再生を予約する
    // ただし現在のバッファがすでに終了している場合は現在時刻で再生を予約する（=今すぐ再生する）
    const baseTime = Math.max(lastBufferEndTime, context.currentTime);
    source.start(baseTime);

    // 予約した再生時刻に合わせてonChunkStartを呼ぶ
    const currentSampleTime = numTotalSamples / sampleRate;
    cancelables.use(
      new DisposableTimeout((baseTime - context.currentTime) * 1000, () =>
        callbacks.onChunkStart?.(currentSampleTime),
      ),
    );
    numTotalSamples += leftSamples.length;
    lastBufferEndTime = baseTime + audioBuffer.duration;
  }

  // 最後のチャンクの再生が終了するか、中断されるまで待つ
  const { promise: playbackEnded, resolve: resolvePlaybackEnd } =
    Promise.withResolvers<void>();
  using _playbackEndNotifier = new DisposableTimeout(
    (lastBufferEndTime - context.currentTime) * 1000,
    resolvePlaybackEnd,
  );
  await Promise.race([playbackEnded, cancelledPromise]);
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
          using cancellables = new DisposableStack();
          cancellables.defer(() => {
            mutations.SET_CURRENT_PLAY_STATE({
              currentPlayState: { type: "stopped" },
            });
          });

          const audioItem = cloneWithUnwrapProxy(state.audioItems[audioKey]);
          mutations.SET_CURRENT_PLAY_STATE({
            currentPlayState: { type: "preparing" },
          });

          const playbackStartPosition = ensureNotNullish(
            (await actions.GET_AUDIO_PLAY_OFFSETS({ audioKey })).at(
              getters.AUDIO_PLAY_START_POINT ?? 0,
            ),
          );

          const { stream, streamOffset, isStreamingSynthesis } =
            await actions.FETCH_AUDIO_STREAM({
              audioItem,
              playbackStartPosition,
              signal,
            });
          return await actions.PLAY_AUDIO_STREAM({
            stream: new WavStream(stream),
            streamOffset,
            audioKey,
            playbackStartPosition,
            signal,
            isStreamingSynthesis,
          });
        }),
    ),
  },

  PLAY_CONTINUOUSLY_AUDIO: {
    action: createUILockAction(async ({ state, getters, mutations, actions }) =>
      audioPlayMutex.lock(async (signal) => {
        if (signal.aborted) return;
        const currentAudioKey = getters.ACTIVE_AUDIO_KEY;
        const currentAudioPlayStartPoint = getters.AUDIO_PLAY_START_POINT;
        const index =
          currentAudioKey == undefined
            ? 0
            : state.audioKeys.indexOf(currentAudioKey);
        const playbackStartPosition =
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
        mutations.SET_NOW_PLAYING_CONTINUOUSLY({ nowPlaying: true });
        await playContinuously(audioKeys, {
          async fetchAudio({ audioKey, abortSignal }) {
            return actions.FETCH_AUDIO_STREAM({
              audioItem: state.audioItems[audioKey],
              signal: AbortSignal.any([signal, abortSignal]),
              playbackStartPosition:
                audioKey === currentAudioKey ? playbackStartPosition : 0,
            });
          },
          playAudioStream({
            audioKey,
            audio: { streamOffset, stream, isStreamingSynthesis },
          }) {
            if (currentAudioKey !== audioKey) {
              mutations.SET_AUDIO_PLAY_START_POINT({ startPoint: undefined });
            }
            return actions.PLAY_AUDIO_STREAM({
              stream: new WavStream(stream),
              streamOffset,
              audioKey,
              signal,
              playbackStartPosition:
                audioKey === currentAudioKey ? playbackStartPosition : 0,
              isStreamingSynthesis,
            });
          },
          onWaitStart(audioKey) {
            mutations.SET_ACTIVE_AUDIO_KEY({ audioKey });
            mutations.SET_CURRENT_PLAY_STATE({
              currentPlayState: { type: "preparing" },
            });
          },
        }).finally(() => {
          mutations.SET_CURRENT_PLAY_STATE({
            currentPlayState: { type: "stopped" },
          });
          mutations.SET_ACTIVE_AUDIO_KEY({ audioKey: currentAudioKey });
          mutations.SET_AUDIO_PLAY_START_POINT({
            startPoint: currentAudioPlayStartPoint,
          });
          mutations.SET_NOW_PLAYING_CONTINUOUSLY({ nowPlaying: false });
        });
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
      {
        stream,
        streamOffset,
        audioKey,
        playbackStartPosition,
        signal,
        isStreamingSynthesis,
      },
    ) {
      if (signal.aborted) return false;
      using cancellables = new DisposableStack();
      cancellables.defer(() => {
        void stream.cancel();
        mutations.SET_CURRENT_PLAY_STATE({
          currentPlayState: { type: "stopped" },
        });
      });

      let delayNotified = false;
      await playAudioStream(stream, streamOffset, signal, {
        onDelay() {
          if (
            isStreamingSynthesis &&
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
              currentTime: playbackStartPosition + time,
            },
          });
        },
      });
      return !signal.aborted;
    },
  },
});
