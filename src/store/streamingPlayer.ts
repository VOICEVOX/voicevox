import type { StreamingWavParser } from "@/domain/streamingWavParser";

let audioContext: AudioContext | null = null;
if (window.AudioContext) {
  audioContext = new AudioContext();
}

const samplesPerChunk = 4096;

const cancelled = Symbol("cancelled");

export async function playAudioStream(
  audioStream: StreamingWavParser,
  cancel: AbortSignal,
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
  try {
    const header = await audioStream.readHeader();
    const sampleRate = header.sampleRate;

    const samplesIterator = audioStream.readSamples(samplesPerChunk);
    while (true) {
      const audioBuffer = audioContext.createBuffer(
        2,
        samplesPerChunk,
        sampleRate,
      );
      const leftChannel = audioBuffer.getChannelData(0);
      const rightChannel = audioBuffer.getChannelData(1);
      let offset = 0;

      const chunkOrDone = await Promise.race([
        samplesIterator.next(),
        cancelledPromise,
      ]);
      if (chunkOrDone === cancelled) {
        break;
      }
      const chunk = chunkOrDone.value as [number, number][];
      if (chunk.length === 0 || chunkOrDone.done) {
        break;
      }
      for (const [left, right] of chunk) {
        leftChannel[offset] = left;
        rightChannel[offset] = right;
        offset++;
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      const baseTime = Math.max(lastBufferEndTime, audioContext.currentTime);
      source.start(baseTime);
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

    for (const source of bufferSources) {
      source.stop();
    }
  }
}
