import type { WavStream } from "@/domain/wavStream";

let audioContext: AudioContext | null = null;
if (window.AudioContext) {
  audioContext = new AudioContext();
}

const samplesPerChunk = 4096;

const cancelled = Symbol("cancelled");

export async function playAudioStreams(
  audioStreams: WavStream[],
  cancel: AbortSignal,
  callbacks: {
    onStart?: (index: number) => void;
    onChunkStart?: (index: number, time: number) => void;
    onDelay?: () => void;
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
