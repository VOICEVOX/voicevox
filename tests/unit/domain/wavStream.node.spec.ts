import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { WavStream } from "@/domain/wavStream";

const wav = readFileSync("tests/unit/domain/fixtures/wavStream.wav");
const expectedSamples = Float32Array.from(
  { length: 44100 * 5 * 2 },
  (_, index) => wav.readInt16LE(44 + index * 2) / 32768,
);
const expectedLeftSamples = expectedSamples.filter(
  (_, index) => index % 2 === 0,
);
const expectedRightSamples = expectedSamples.filter(
  (_, index) => index % 2 === 1,
);

function createParser(bytes: Uint8Array, chunkSize: number) {
  let offset = 0;
  return new WavStream(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(bytes.subarray(offset, offset + chunkSize));
        offset += chunkSize;
        if (offset >= bytes.length) {
          controller.close();
          return;
        }
      },
    }),
  );
}

const chunkSize = 1024;
test("PCM16ステレオのヘッダーを読み取れる", async () => {
  const parser = createParser(wav, chunkSize);
  await expect(parser.readHeader()).resolves.toEqual({
    audioFormat: "pcm16le",
    numChannels: 2,
    sampleRate: 44100,
    byteRate: 176400,
    blockAlign: 4,
    bitsPerSample: 16,
  });
});

test("全サンプルを読み取れる", async () => {
  const parser = createParser(wav, chunkSize);
  await parser.readHeader();
  let numSamples = 0;
  for await (const [leftChunk, rightChunk] of parser.readSamples(1024)) {
    const expectedChunkSize = Math.min(
      chunkSize,
      expectedSamples.length / 2 - numSamples,
    );
    expect(leftChunk).toHaveLength(expectedChunkSize);
    expect(rightChunk).toHaveLength(expectedChunkSize);
    expect(leftChunk).toEqual(
      expectedLeftSamples.subarray(numSamples, numSamples + expectedChunkSize),
    );
    expect(rightChunk).toEqual(
      expectedRightSamples.subarray(numSamples, numSamples + expectedChunkSize),
    );
    numSamples += leftChunk.length;
  }
  expect(numSamples).toBe(expectedSamples.length / 2);
});

test("音声全体より大きいフレーム数を指定すると全サンプルを一度に返す", async () => {
  const parser = createParser(wav, wav.length);
  await parser.readHeader();
  const chunks: [Float32Array, Float32Array][] = [];
  for await (const chunk of parser.readSamples(
    expectedSamples.length / 2 + 1,
  )) {
    chunks.push(chunk);
  }
  expect(chunks).toHaveLength(1);
  expect(chunks[0]).toEqual([expectedLeftSamples, expectedRightSamples]);
});

test("ヘッダーの途中でストリームが終了するとエラーになる", async () => {
  const parser = createParser(new TextEncoder().encode("RIFF"), 1);
  await expect(parser.readHeader()).rejects.toThrow(
    "Stream ended before reading enough bytes",
  );
});
