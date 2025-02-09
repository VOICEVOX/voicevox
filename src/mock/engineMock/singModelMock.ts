/**
 * ソング系の構造体を作るモック。
 */

import { moraToPhonemes } from "./phonemeMock";
import { convertHiraToKana } from "@/domain/japanese";
import { Note, FramePhoneme } from "@/openapi";

function noteNumberToFrequency(noteNumber: number) {
  return 440 * Math.pow(2, (noteNumber - 69) / 12);
}

/** アルファベット文字列を適当な0~1の適当な数値に変換する */
function alphabetsToNumber(text: string): number {
  const codes = text.split("").map((c) => c.charCodeAt(0));
  const sum = codes.reduce((a, b) => a + b);
  return (sum % 256) / 256;
}

/** 0.01~0.25になるように適当な長さを決める */
function phonemeToLengthMock(phoneme: string): number {
  return alphabetsToNumber(phoneme) * 0.24 + 0.01;
}

/** 揺れ幅が-30cent~30centになるように適当なピッチを決める */
function phonemeAndKeyToPitchMock(phoneme: string, key: number): number {
  const base = noteNumberToFrequency(key);
  const shift = (-30 + 60 * alphabetsToNumber(phoneme)) / 1200;
  return base * Math.pow(2, shift);
}

/** 0.8~1.0になるような適当な音量を決める */
function phonemeAndPitchToVolumeMock(phoneme: string, pitch: number): number {
  const minPitch = noteNumberToFrequency(1);
  const maxPitch = noteNumberToFrequency(128);
  const normalized = (pitch - minPitch) / (maxPitch - minPitch);
  return 0.75 + normalized * 0.2 + alphabetsToNumber(phoneme) * 0.05;
}

/**
 * ノートから音素と適当な音素長を作成する。
 * 母音の開始位置をノートの開始位置は一致させ、子音は前のノートに食い込むようにする。
 */
export function notesToFramePhonemesMock(
  notes: Note[],
  styleId: number,
): FramePhoneme[] {
  const framePhonemes: FramePhoneme[] = [];
  for (const note of notes) {
    const noteId = note.id;

    // 休符の場合はノートの長さ
    if (note.key == undefined && note.lyric == "") {
      framePhonemes.push({
        noteId,
        phoneme: "pau",
        frameLength: note.frameLength,
      });
      continue;
    }

    const phonemes = moraToPhonemes[convertHiraToKana(note.lyric)];
    if (phonemes == undefined)
      throw new Error(`音素に変換できません: ${note.lyric}`);

    const [consonant, vowel] = phonemes;

    if (consonant != undefined) {
      // 子音は適当な長さ
      let consonantLength = phonemeToLengthMock(consonant);

      // 別の歌手で同じにならないように適当に値をずらす
      consonantLength += styleId * 0.03;

      // 子音の長さが前のノートの長さ以上になる場合、子音の長さをノートの半分にする
      const beforeFramePhoneme = framePhonemes[framePhonemes.length - 1];
      if (beforeFramePhoneme.frameLength < consonantLength) {
        consonantLength = beforeFramePhoneme.frameLength / 2;
      }

      // 整数値にする
      consonantLength = Math.max(Math.round(consonantLength), 1);

      // 子音は前のノートに食い込む
      beforeFramePhoneme.frameLength -= consonantLength;
      framePhonemes.push({
        noteId,
        phoneme: consonant,
        frameLength: consonantLength,
      });
    }

    // 母音はノートの長さ
    const vowelLength = note.frameLength;
    framePhonemes.push({ noteId, phoneme: vowel, frameLength: vowelLength });
  }

  return framePhonemes;
}

/** ノートと音素長から適当なピッチを作成する */
export function notesAndFramePhonemesToPitchMock(
  notes: Note[],
  framePhonemes: FramePhoneme[],
  styleId: number,
): number[] {
  // 製品版エンジンへの特別対応の都合でstyleId=6000が来ることがあるので特別処理
  styleId %= 6000;

  return framePhonemes.flatMap((phoneme, i) => {
    let pitch;

    // 休符の場合は0
    if (phoneme.phoneme == "pau") {
      pitch = 0;
    } else {
      // IDが同じノートを探す
      const note = notes
        .filter((note) => note.id != undefined)
        .find((note) => note.id == phoneme.noteId);
      if (note == undefined)
        throw new Error(
          `ノートが見つかりません: index=${i} phoneme=${phoneme.phoneme}`,
        );

      if (note.key != undefined) {
        pitch = phonemeAndKeyToPitchMock(phoneme.phoneme, note.key);

        // 別の歌手で同じにならないように適当に値をずらす
        pitch *= 1 + styleId * 0.03;
      } else {
        pitch = 0;
      }
    }

    return Array<number>(phoneme.frameLength).fill(pitch);
  });
}

/**
 * ノートと音素長とピッチから適当な音量を作成する。
 * ピッチが高いほど音量が大きくなるようにする。
 * NOTE: ノートは一旦無視している。
 */
export function notesAndFramePhonemesAndPitchToVolumeMock(
  notes: Note[],
  framePhonemes: FramePhoneme[],
  f0: number[],
  styleId: number,
): number[] {
  const phonemePerFrame = framePhonemes.flatMap((phoneme) =>
    Array<string>(phoneme.frameLength).fill(phoneme.phoneme),
  );

  return Array<number>(f0.length)
    .fill(-1)
    .map((_, i) => {
      const phoneme = phonemePerFrame[i];
      const pitch = f0[i];

      let volume = phonemeAndPitchToVolumeMock(phoneme, pitch);

      // 別の歌手で同じにならないように適当に値をずらす
      volume *= 1 - styleId * 0.03;

      return volume;
    });
}
