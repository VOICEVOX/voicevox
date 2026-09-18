import { generateUniqueIdAndQuery } from "./audioGenerate";
import { playAudioWithAbort } from "./audioPlayer";
import { convertAudioQueryFromEditorToEngine } from "./proxy";
import type { AudioStreamPlayerStoreTypes } from "./type";
import { createUILockAction } from "./ui";
import { createPartialStore } from "./vuex";
import { createLogger } from "@/helpers/log";
import { WavStream } from "@/domain/wavStream";
import type { AudioKey } from "@/type/preload";
import { assertNonNullable, ensureNotNullish } from "@/type/utility";
import { LruCache } from "@/helpers/lruCache";
import { showAlertDialog } from "@/components/Dialog/Dialog";

const log = createLogger("store/audioStreamPlayer");
let audioContext: AudioContext | null = null;
if (window.AudioContext) {
  audioContext = new AudioContext();
}

const samplesPerChunk = 4096;

const cancelled = Symbol("cancelled");

const audioCache = new LruCache<
  string,
  {
    wav: Blob;
    startsAt: number;
  }
>(64);

export async function playAudioStreams(
  audioStreams: WavStream[],
  cancel: AbortSignal,
  callbacks: {
    onStart?: (index: number) => void;
    onChunkStart?: (index: number, time: number) => void;
    onDelay?: () => void;
    onFetchEnd?: (index: number) => void | Promise<void>;
  } = {},
) {
  if (!audioContext) {
    throw new Error("AudioContext is not supported in this browser.");
  }
  if (audioContext.state === "suspended") {
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
  let lastDelayNotifier: ReturnType<typeof setTimeout> | null = null;
  const chunkStartNotifiers: ReturnType<typeof setTimeout>[] = [];
  for (const [index, audioStream] of audioStreams.entries()) {
    try {
      const header = await Promise.race([
        cancelledPromise,
        audioStream.readHeader(),
      ]);
      if (header === cancelled) return;
      const sampleRate = header.sampleRate;

      const samplesIterator = audioStream.readSamples(samplesPerChunk);
      let numTotalSamples = 0;
      while (true) {
        // 最初のチャンクは遅延通知をしない
        if (numTotalSamples > 0) {
          lastDelayNotifier = setTimeout(
            () => {
              callbacks.onDelay?.();
            },
            Math.max(0, lastBufferEndTime - audioContext.currentTime) * 1000,
          );
        }
        const chunkOrDone = await Promise.race([
          cancelledPromise,
          samplesIterator.next(),
        ]);
        if (lastDelayNotifier != null) {
          clearTimeout(lastDelayNotifier);
          lastDelayNotifier = null;
        }
        if (chunkOrDone === cancelled) {
          return;
        }
        if (chunkOrDone.done) {
          break;
        }
        if (numTotalSamples === 0) {
          callbacks.onStart?.(index);
        }

        const audioBuffer = audioContext.createBuffer(
          2,
          chunkOrDone.value.length,
          sampleRate,
        );
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.getChannelData(1);
        let offset = 0;
        for (const [left, right] of chunkOrDone.value) {
          leftChannel[offset] = left;
          rightChannel[offset] = right;
          offset++;
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        const baseTime = Math.max(lastBufferEndTime, audioContext.currentTime);
        source.start(baseTime);
        const currentSampleTime = numTotalSamples / sampleRate;
        chunkStartNotifiers.push(
          setTimeout(
            () => callbacks.onChunkStart?.(index, currentSampleTime),
            (baseTime - audioContext.currentTime) * 1000,
          ),
        );
        numTotalSamples += offset;
        lastBufferEndTime = baseTime + audioBuffer.duration;
        bufferSources.push(source);
      }

      if (!cancel.aborted) await callbacks.onFetchEnd?.(index);
    } finally {
      if (lastDelayNotifier != null) clearTimeout(lastDelayNotifier);
      await Promise.race([
        new Promise<void>((resolve) => {
          setTimeout(
            resolve,
            (lastBufferEndTime - audioContext.currentTime) * 1000,
          );
        }),
        cancelledPromise,
      ]);

      for (const notifier of chunkStartNotifiers) {
        clearTimeout(notifier);
      }

      for (const source of bufferSources) {
        source.stop();
      }
    }
  }
}

export const audioStreamPlayerStore =
  createPartialStore<AudioStreamPlayerStoreTypes>({
    PLAY_AUDIO_STREAMING: {
      action: createUILockAction(
        async (
          { state, mutations, getters, actions },
          { audioKey }: { audioKey: AudioKey },
        ) => {
          await actions.STOP_AUDIO();

          const engineId = state.audioItems[audioKey].voice.engineId;
          const engineManifest = state.engineManifests[engineId];
          if (!engineManifest.supportedFeatures?.streamingSynthesis) {
            throw new Error("Streaming synthesis is not supported.");
          }
          const audioItem = state.audioItems[audioKey];
          const [id, editorAudioQuery] = await generateUniqueIdAndQuery(
            state,
            audioItem,
          );
          assertNonNullable(editorAudioQuery);
          const segmentLength = {
            LOW_LATENCY: 0.3,
            BALANCED: 1.0,
            STABLE: 9999,
          }[state.streamingMode];
          const cacheKey = `${id}:${segmentLength}`;
          const audioQuery = convertAudioQueryFromEditorToEngine(
            editorAudioQuery,
            engineManifest.defaultSamplingRate,
          );
          const accentPhraseOffsets = await actions.GET_AUDIO_PLAY_OFFSETS({
            audioKey,
          });
          if (accentPhraseOffsets.length === 0)
            throw new Error("accentPhraseOffsets.length === 0");
          const startTime =
            accentPhraseOffsets[getters.AUDIO_PLAY_START_POINT ?? 0];

          return await playAudioWithAbort(async (abortSignal) => {
            try {
              if (audioContext?.setSinkId) {
                const device = state.savingSetting.audioOutputDevice;
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
              const existingCache = audioCache.get(cacheKey);
              if (existingCache && existingCache.startsAt <= startTime) {
                log.info(
                  `Using cached audio for ${audioKey} starting at ${existingCache.startsAt} with offset ${startTime - existingCache.startsAt}`,
                );
                const wavBlob = existingCache.wav;
                const wavStreamForPlay = new WavStream(
                  wavBlob.stream(),
                  startTime - existingCache.startsAt,
                );

                await playAudioStreams([wavStreamForPlay], abortSignal, {
                  onChunkStart(_index, time) {
                    mutations.SET_CURRENT_PLAY_STATE({
                      currentPlayState: {
                        type: "streaming",
                        audioKey,
                        currentTime: time + startTime,
                      },
                    });
                  },
                });
                return !abortSignal.aborted;
              } else {
                log.info(
                  `Generating audio for ${audioKey} starting at ${startTime}`,
                );

                mutations.SET_AUDIO_NOW_GENERATING({
                  audioKey,
                  nowGenerating: true,
                });
                const response = await actions
                  .INSTANTIATE_ENGINE_CONNECTOR({
                    engineId,
                  })
                  .then((instance) =>
                    instance.invoke("streamingSynthesisRaw")(
                      {
                        audioQuery,
                        speaker: audioItem.voice.styleId,
                        enableInterrogativeUpspeak:
                          state.experimentalSetting.enableInterrogativeUpspeak,
                        startOffset: startTime,
                        segmentLength,
                      },
                      {
                        signal: abortSignal,
                      },
                    ),
                  );

                const wavBody = ensureNotNullish(response.raw.body);
                const [wavBodyForPlay, wavBodyForSave] = wavBody.tee();

                const wavStream = new WavStream(wavBodyForPlay);
                let delayNotified = false;
                await playAudioStreams([wavStream], abortSignal, {
                  onStart() {
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
                        message: "このPCではストリーミング再生が推奨されません",
                        icon: "warning",
                        tipName: "streamingUnrecommended",
                      });
                    }
                  },
                  async onFetchEnd() {
                    if (abortSignal.aborted) return;
                    log.info(
                      `Caching audio for ${audioKey} starting at ${startTime}`,
                    );
                    const wavBlob = await new Response(wavBodyForSave).blob();
                    if (abortSignal.aborted) return;
                    audioCache.set(cacheKey, {
                      wav: wavBlob,
                      startsAt: startTime,
                    });
                  },
                });
                return !abortSignal.aborted;
              }
            } finally {
              mutations.SET_AUDIO_NOW_GENERATING({
                audioKey,
                nowGenerating: false,
              });
              mutations.SET_CURRENT_PLAY_STATE({
                currentPlayState: { type: "stopped" },
              });
            }
          });
        },
      ),
    },
  });
