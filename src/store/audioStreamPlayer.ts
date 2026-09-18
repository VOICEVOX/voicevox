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
    onFetchEnd?: (index: number) => void;
  } = {},
) {
  if (!audioContext) {
    throw new Error("AudioContext is not supported in this browser.");
  }

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
      const header = await audioStream.readHeader();
      const sampleRate = header.sampleRate;

      const samplesIterator = audioStream.readSamples(samplesPerChunk);
      let numTotalSamples = 0;
      while (true) {
        const audioBuffer = audioContext.createBuffer(
          2,
          samplesPerChunk,
          sampleRate,
        );
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.getChannelData(1);
        let offset = 0;

        // 最初のチャンクは遅延通知をしない
        if (numTotalSamples > 0) {
          lastDelayNotifier = setTimeout(
            () => {
              callbacks.onDelay?.();
            },
            (samplesPerChunk / sampleRate) * 1000,
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
          break;
        }
        if (chunkOrDone.done) {
          break;
        }
        if (numTotalSamples === 0) {
          callbacks.onStart?.(index);
        }

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

      callbacks.onFetchEnd?.(index);
    } finally {
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
            const existingCache = audioCache.get(id);
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
              mutations.SET_CURRENT_PLAY_STATE({
                currentPlayState: {
                  type: "stopped",
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
                    },
                    {
                      signal: abortSignal,
                    },
                  ),
                );

              const wavBody = ensureNotNullish(response.raw.body);
              const [wavBodyForPlay, wavBodyForSave] = wavBody.tee();

              const wavStream = new WavStream(wavBodyForPlay);
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
                async onFetchEnd() {
                  log.info(
                    `Caching audio for ${audioKey} starting at ${startTime}`,
                  );
                  const wavBlob = await new Response(wavBodyForSave).blob();
                  audioCache.set(id, {
                    wav: wavBlob,
                    startsAt: startTime,
                  });
                },
              });
              mutations.SET_CURRENT_PLAY_STATE({
                currentPlayState: {
                  type: "stopped",
                },
              });
              return !abortSignal.aborted;
            }
          });
        },
      ),
    },
  });
