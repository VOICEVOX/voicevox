import {
  createMp3Encoder,
  createOggEncoder,
  WasmMediaEncoder,
} from "wasm-media-encoders";

export type SupportedAudioFormat = "wav" | "mp3" | "ogg";

const convertToWavFileData = (audioBuffer: AudioBuffer) => {
  const bytesPerSample = 4; // Float32
  const formatCode = 3; // WAVE_FORMAT_IEEE_FLOAT

  const numberOfChannels = audioBuffer.numberOfChannels;
  const numberOfSamples = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const byteRate = sampleRate * numberOfChannels * bytesPerSample;
  const blockSize = numberOfChannels * bytesPerSample;
  const dataSize = numberOfSamples * numberOfChannels * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const dataView = new DataView(buffer);

  let pos = 0;
  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i++) {
      dataView.setUint8(pos, value.charCodeAt(i));
      pos += 1;
    }
  };
  const writeUint32 = (value: number) => {
    dataView.setUint32(pos, value, true);
    pos += 4;
  };
  const writeUint16 = (value: number) => {
    dataView.setUint16(pos, value, true);
    pos += 2;
  };
  const writeSample = (offset: number, value: number) => {
    dataView.setFloat32(pos + offset * 4, value, true);
  };

  writeString("RIFF");
  writeUint32(36 + dataSize); // RIFFチャンクサイズ
  writeString("WAVE");
  writeString("fmt ");
  writeUint32(16); // fmtチャンクサイズ
  writeUint16(formatCode);
  writeUint16(numberOfChannels);
  writeUint32(sampleRate);
  writeUint32(byteRate);
  writeUint16(blockSize);
  writeUint16(bytesPerSample * 8); // 1サンプルあたりのビット数
  writeString("data");
  writeUint32(dataSize);

  for (let i = 0; i < numberOfChannels; i++) {
    const channelData = audioBuffer.getChannelData(i);
    for (let j = 0; j < numberOfSamples; j++) {
      writeSample(j * numberOfChannels + i, channelData[j]);
    }
  }

  return new Uint8Array(buffer);
};

export const encodeAudioData = async (
  audioBuffer: AudioBuffer,
  encoder: WasmMediaEncoder<"audio/ogg" | "audio/mpeg">,
) => {
  let outBuffer = new Uint8Array(1024 * 1024);
  let offset = 0;
  let moreData = true;
  encoder.configure({
    channels: audioBuffer.numberOfChannels as 1 | 2,
    sampleRate: audioBuffer.sampleRate,
  });

  while (true) {
    const mp3Data = moreData
      ? encoder.encode(
          audioBuffer.numberOfChannels === 1
            ? [audioBuffer.getChannelData(0)]
            : [audioBuffer.getChannelData(0), audioBuffer.getChannelData(1)],
        )
      : encoder.finalize();

    if (mp3Data.length + offset > outBuffer.length) {
      const newBuffer = new Uint8Array(mp3Data.length + offset);
      newBuffer.set(outBuffer);
      outBuffer = newBuffer;
    }

    outBuffer.set(mp3Data, offset);
    offset += mp3Data.length;

    if (!moreData) {
      break;
    }

    moreData = false;
  }

  return outBuffer.slice(0, offset);
};

const convertToMp3Data = async (audioBuffer: AudioBuffer) => {
  const encoder = await createMp3Encoder();
  const mp3Data = await encodeAudioData(audioBuffer, encoder);
  return mp3Data;
};

const convertToOggData = async (audioBuffer: AudioBuffer) => {
  const encoder = await createOggEncoder();
  const oggData = await encodeAudioData(audioBuffer, encoder);
  return oggData;
};

export const convertToSupportedAudioFormat = async (
  audioBuffer: AudioBuffer,
  format: SupportedAudioFormat,
) => {
  switch (format) {
    case "wav":
      return convertToWavFileData(audioBuffer);
    case "mp3":
      return convertToMp3Data(audioBuffer);
    case "ogg":
      return convertToOggData(audioBuffer);
  }
};
