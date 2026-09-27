export type WavHeader = {
  audioFormat: "pcm16le" | "float32le";
  numChannels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
};

/**
 * WAVファイルのReadableStreamを受け取り、WAVヘッダーと波形データを読み取る。
 */
export class WavStream {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private buffer: Uint8Array;
  private bufferOffset: number;
  private header?: WavHeader;

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream.getReader();
    this.buffer = new Uint8Array(0);
    this.bufferOffset = 0;
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
        const fmtChunk = await this.readBytes(size + (size % 2));
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
        await this.readBytes(size + (size % 2));
      }
    }
  }

  /**
   * WAVの波形データを読み取る。
   * 受けとるデータはfloat32のステレオに変換される。
   *
   * @param samplesPerChunk 1回のyieldで返すサンプル数
   * @param startOffset 読み取り開始位置（サンプル単位）
   *
   * このメソッドを使用したあとのWavStreamは再利用しないこと。
   */
  async *readSamples(
    samplesPerChunk: number,
    startOffset: number = 0,
  ): AsyncGenerator<[Float32Array, Float32Array], undefined> {
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
        await this.readBytes(size + (size % 2));
      }
    }

    let bytesRead = 0;
    const bytesPerSample =
      (this.header.bitsPerSample / 8) * this.header.numChannels;
    const bytesToSkip = Math.min(startOffset * bytesPerSample, dataChunkSize);
    while (bytesRead < bytesToSkip) {
      const size = Math.min(
        samplesPerChunk * bytesPerSample,
        bytesToSkip - bytesRead,
      );
      await this.readBytes(size);
      bytesRead += size;
    }
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

      const nextChunkSize = chunk.length / bytesPerSample;
      const leftSamples = new Float32Array(nextChunkSize);
      const rightSamples = new Float32Array(nextChunkSize);
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
        leftSamples[i / bytesPerSample] = left;
        rightSamples[i / bytesPerSample] = right;
      }
      yield [leftSamples, rightSamples];
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
    if (this.buffer.length - this.bufferOffset >= size) {
      const result = this.buffer.subarray(
        this.bufferOffset,
        this.bufferOffset + size,
      );
      this.bufferOffset += size;
      return result;
    }

    // 必要なサイズを一度だけ確保し、受信ごとの蓄積データの再コピーを避ける。
    const result = new Uint8Array(size);
    let offset = 0;
    while (offset < size) {
      if (this.bufferOffset === this.buffer.length) {
        const { value, done } = await this.reader.read();
        if (done) {
          throw new Error("Stream ended before reading enough bytes");
        }
        this.buffer = value;
        this.bufferOffset = 0;
      }
      const length = Math.min(
        size - offset,
        this.buffer.length - this.bufferOffset,
      );
      result.set(
        this.buffer.subarray(this.bufferOffset, this.bufferOffset + length),
        offset,
      );
      this.bufferOffset += length;
      offset += length;
    }

    return result;
  }
}
