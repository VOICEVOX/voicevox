export type WavHeader = {
  audioFormat: "pcm16le" | "float32le";
  numChannels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
};

export class StreamingWavParser {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private buffer: Uint8Array;
  private bufferOffset: number;
  private bufferLength: number;
  private header?: WavHeader;

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader();
    this.buffer = new Uint8Array(0);
    this.bufferOffset = 0;
    this.bufferLength = 0;
  }

  /**
   * 最初のWAVヘッダーを読み取る。
   */
  async readHeader(): Promise<WavHeader> {
    const riffHeader = await this.readBytes(12);
    if (String.fromCharCode(...riffHeader.subarray(0, 4)) !== "RIFF") {
      throw new Error("Invalid WAV file: Missing 'RIFF' header");
    }
    if (String.fromCharCode(...riffHeader.subarray(8, 12)) !== "WAVE") {
      throw new Error("Invalid WAV file: Missing 'WAVE' format");
    }

    while (true) {
      const { id, size } = await this.readChunkHeader();
      if (id === "fmt ") {
        const fmtChunk = await this.readBytes(size);
        const view = new DataView(
          fmtChunk.buffer,
          fmtChunk.byteOffset,
          fmtChunk.byteLength,
        );
        const audioFormat = view.getUint16(0, true);
        const numChannels = view.getUint16(2, true);
        const sampleRate = view.getUint32(4, true);
        const byteRate = view.getUint32(8, true);
        const blockAlign = view.getUint16(12, true);
        const bitsPerSample = view.getUint16(14, true);

        const header: WavHeader = {
          audioFormat: audioFormat === 1 ? "pcm16le" : "float32le",
          numChannels,
          sampleRate,
          byteRate,
          blockAlign,
          bitsPerSample,
        };
        this.header = header;
        return header;
      } else if (id === "data") {
        throw new Error(
          "Invalid WAV file: 'data' chunk found before 'fmt ' chunk",
        );
      } else {
        // Skip unknown chunk
      }
    }
  }

  /**
   * WAVの波形データを読み取る。
   * 受けとるデータはfloat32のステレオに変換される。
   */
  async *readDataChunks(
    samplesPerChunk: number,
  ): AsyncGenerator<[number, number][]> {
    if (!this.header) {
      throw new Error("WAV header not read yet");
    }
    let dataChunkSize;
    while (true) {
      const { id, size } = await this.readChunkHeader();
      if (id === "data") {
        dataChunkSize = size;
        break;
      } else {
        // Skip unknown chunk
      }
    }

    let bytesRead = 0;
    const bytesPerSample =
      (this.header.bitsPerSample / 8) * this.header.numChannels;
    while (bytesRead < dataChunkSize) {
      const chunk = await this.readBytes(
        Math.min(samplesPerChunk * bytesPerSample, dataChunkSize - bytesRead),
      );
      bytesRead += chunk.length;
      const view = new DataView(
        chunk.buffer,
        chunk.byteOffset,
        chunk.byteLength,
      );

      const samples: [number, number][] = [];
      for (let i = 0; i < chunk.length; i += bytesPerSample) {
        let left: number, right: number;
        if (this.header.audioFormat === "pcm16le") {
          left = view.getInt16(i, true) / 32768;
          right =
            this.header.numChannels === 2
              ? view.getInt16(i + 2, true) / 32768
              : left;
        } else {
          left = view.getFloat32(i, true);
          right =
            this.header.numChannels === 2 ? view.getFloat32(i + 4, true) : left;
        }
        samples.push([left, right]);
      }
      yield samples;
    }
  }

  private async readChunkHeader(): Promise<{ id: string; size: number }> {
    const chunkHeader = await this.readBytes(8);
    const id = String.fromCharCode(...chunkHeader.subarray(0, 4));
    const size = new DataView(
      chunkHeader.buffer,
      chunkHeader.byteOffset,
      chunkHeader.byteLength,
    ).getUint32(4, true);
    return { id, size };
  }

  private async readBytes(size: number): Promise<Uint8Array> {
    while (this.bufferLength < size) {
      const { value, done } = await this.reader.read();
      if (done) {
        throw new Error("Stream ended before reading enough bytes");
      }
      const newBuffer = new Uint8Array(this.bufferLength + value.length);
      newBuffer.set(
        this.buffer.subarray(
          this.bufferOffset,
          this.bufferOffset + this.bufferLength,
        ),
        0,
      );
      newBuffer.set(value, this.bufferLength);
      this.buffer = newBuffer;
      this.bufferOffset = 0;
      this.bufferLength += value.length;
    }

    const result = this.buffer.subarray(
      this.bufferOffset,
      this.bufferOffset + size,
    );
    this.bufferOffset += size;
    this.bufferLength -= size;

    return result;
  }
}
