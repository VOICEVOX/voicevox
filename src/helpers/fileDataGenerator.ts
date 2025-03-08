import Encoding from "encoding-japanese";
import { Encoding as EncodingType } from "@/type/preload";

export function generateWavFileData(
  audioBuffer: Pick<
    AudioBuffer,
    "sampleRate" | "length" | "numberOfChannels" | "getChannelData"
  >,
) {
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
}

export async function generateTextFileData(obj: {
  text: string;
  encoding?: EncodingType;
}) {
  obj.encoding ??= "UTF-8";

  const textBlob = {
    "UTF-8": (text: string) => {
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      return new Blob([bom, text], {
        type: "text/plain;charset=UTF-8",
      });
    },
    Shift_JIS: (text: string) => {
      const sjisArray = Encoding.convert(Encoding.stringToCode(text), {
        to: "SJIS",
        type: "arraybuffer",
      });
      return new Blob([new Uint8Array(sjisArray)], {
        type: "text/plain;charset=Shift_JIS",
      });
    },
  }[obj.encoding](obj.text);

  return await textBlob.arrayBuffer();
}
