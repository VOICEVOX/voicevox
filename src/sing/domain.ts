import {
  applySmoothTransitions,
  calculateHash,
  getNext,
  getPrev,
} from "@/sing/utility";
import { convertLongVowel, moraPattern } from "@/domain/japanese";
import {
  type Phrase,
  type PhraseSource,
  PhraseKey,
  type EditorFrameAudioQuery,
} from "@/store/type";
import type { FramePhoneme } from "@/openapi";
import { NoteId, type TrackId } from "@/type/preload";
import type {
  PhonemeTimingEditData,
  Tempo,
  TimeSignature,
  Track,
} from "@/domain/project/type";
import { getRepresentableNoteTypes, isValidNotes } from "@/sing/music";

const MAX_SNAP_TYPE = 32;

export const isTracksEmpty = (tracks: Track[]) =>
  tracks.length === 0 || (tracks.length === 1 && tracks[0].notes.length === 0);

export const isValidTrack = (track: Track) => {
  return (
    isValidKeyRangeAdjustment(track.keyRangeAdjustment) &&
    isValidVolumeRangeAdjustment(track.volumeRangeAdjustment) &&
    isValidNotes(track.notes)
  );
};

export const DEFAULT_TRACK_NAME = "無名トラック";

export const DEFAULT_TPQN = 480;
export const DEFAULT_BPM = 120;
export const DEFAULT_BEATS = 4;
export const DEFAULT_BEAT_TYPE = 4;

// マルチエンジン対応のために将来的に廃止予定で、利用は非推奨
export const DEPRECATED_DEFAULT_EDITOR_FRAME_RATE = 93.75;

export const VALUE_INDICATING_NO_DATA = -1;

export const VOWELS = ["N", "a", "e", "i", "o", "u", "A", "E", "I", "O", "U"];

export const UNVOICED_PHONEMES = [
  "pau",
  "cl",
  "ch",
  "f",
  "h",
  "k",
  "p",
  "s",
  "sh",
  "t",
  "ts",
];

export function isVowel(phoneme: string) {
  return VOWELS.includes(phoneme);
}

export function createDefaultTempo(position: number): Tempo {
  return { position, bpm: DEFAULT_BPM };
}

export function createDefaultTimeSignature(
  measureNumber: number,
): TimeSignature {
  return {
    measureNumber,
    beats: DEFAULT_BEATS,
    beatType: DEFAULT_BEAT_TYPE,
  };
}

export function createDefaultTrack(): Track {
  return {
    name: DEFAULT_TRACK_NAME,
    singer: undefined,
    keyRangeAdjustment: 0,
    volumeRangeAdjustment: 0,
    notes: [],
    pitchEditData: [],
    volumeEditData: [],
    phonemeTimingEditData: new Map(),

    solo: false,
    mute: false,
    gain: 1,
    pan: 0,
  };
}

export function getSnapTypes(tpqn: number) {
  return getRepresentableNoteTypes(tpqn).filter((value) => {
    return value <= MAX_SNAP_TYPE;
  });
}

export function isValidSnapType(snapType: number, tpqn: number) {
  return getSnapTypes(tpqn).some((value) => value === snapType);
}

export function isValidKeyRangeAdjustment(keyRangeAdjustment: number) {
  return (
    Number.isInteger(keyRangeAdjustment) &&
    keyRangeAdjustment <= 28 &&
    keyRangeAdjustment >= -28
  );
}

export function isValidVolumeRangeAdjustment(volumeRangeAdjustment: number) {
  return (
    Number.isInteger(volumeRangeAdjustment) &&
    volumeRangeAdjustment <= 20 &&
    volumeRangeAdjustment >= -20
  );
}

export function isValidPitchEditData(pitchEditData: number[]) {
  return pitchEditData.every(
    (value) =>
      Number.isFinite(value) &&
      (value > 0 || value === VALUE_INDICATING_NO_DATA),
  );
}

export function isValidVolumeEditData(volumeEditData: number[]) {
  // NOTE: APIの返却が0未満になる場合があるため、0以上かどうかのみ検証する
  return volumeEditData.every(
    (value) =>
      Number.isFinite(value) &&
      (value >= 0 || value === VALUE_INDICATING_NO_DATA),
  );
}

export const calculatePhraseKey = async (phraseSource: PhraseSource) => {
  const hash = await calculateHash(phraseSource);
  return PhraseKey(hash);
};

export function getStartTicksOfPhrase(phrase: Phrase) {
  if (phrase.notes.length === 0) {
    throw new Error("phrase.notes.length is 0.");
  }
  return phrase.notes[0].position;
}

export function getEndTicksOfPhrase(phrase: Phrase) {
  if (phrase.notes.length === 0) {
    throw new Error("phrase.notes.length is 0.");
  }
  const lastNote = phrase.notes[phrase.notes.length - 1];
  return lastNote.position + lastNote.duration;
}

export type PhraseRange = {
  startTicks: number;
  endTicks: number;
};

export function toSortedPhraseRanges<K extends string>(
  phraseRanges: Map<K, PhraseRange>,
) {
  return [...phraseRanges.entries()].sort((a, b) => {
    return a[1].startTicks - b[1].startTicks;
  });
}

/**
 * 次にレンダリングするべきPhraseを探す。
 * phraseRangesが空の場合はエラー
 * 優先順：
 * - 再生位置が含まれるPhrase
 * - 再生位置より後のPhrase
 * - 再生位置より前のPhrase
 */
export function selectPriorPhrase<K extends string>(
  phraseRanges: Map<K, PhraseRange>,
  playheadPosition: number,
): K {
  if (phraseRanges.size === 0) {
    throw new Error("phraseRanges.size is 0.");
  }
  // 再生位置が含まれるPhrase
  for (const [phraseKey, phraseRange] of phraseRanges) {
    if (
      phraseRange.startTicks <= playheadPosition &&
      playheadPosition <= phraseRange.endTicks
    ) {
      return phraseKey;
    }
  }

  const sortedPhraseRanges = toSortedPhraseRanges(phraseRanges);
  // 再生位置より後のPhrase
  for (const [phraseKey, phraseRange] of sortedPhraseRanges) {
    if (phraseRange.startTicks > playheadPosition) {
      return phraseKey;
    }
  }

  // 再生位置より前のPhrase
  return sortedPhraseRanges[0][0];
}

export function convertToFramePhonemes(phonemes: FramePhoneme[]) {
  const framePhonemes: string[] = [];
  for (const phoneme of phonemes) {
    for (let i = 0; i < phoneme.frameLength; i++) {
      framePhonemes.push(phoneme.phoneme);
    }
  }
  return framePhonemes;
}

function secondToRoundedFrame(seconds: number, frameRate: number) {
  return Math.round(seconds * frameRate);
}

export type PhonemeTiming = {
  noteId: NoteId | undefined;
  startFrame: number;
  endFrame: number;
  phoneme: string;
};

/**
 * 音素列を音素タイミング列に変換する。
 */
export function toPhonemeTimings(phonemes: FramePhoneme[]) {
  const phonemeTimings: PhonemeTiming[] = [];
  let cumulativeFrame = 0;
  for (const phoneme of phonemes) {
    phonemeTimings.push({
      noteId: phoneme.noteId != undefined ? NoteId(phoneme.noteId) : undefined,
      startFrame: cumulativeFrame,
      endFrame: cumulativeFrame + phoneme.frameLength,
      phoneme: phoneme.phoneme,
    });
    cumulativeFrame += phoneme.frameLength;
  }
  return phonemeTimings;
}

/**
 * 音素タイミング列を音素列に変換する。
 */
export function toPhonemes(phonemeTimings: PhonemeTiming[]) {
  return phonemeTimings.map(
    (value): FramePhoneme => ({
      phoneme: value.phoneme,
      frameLength: value.endFrame - value.startFrame,
      noteId: value.noteId,
    }),
  );
}

/**
 * 音素タイミング列に音素タイミング編集を適用する。
 */
export function applyPhonemeTimingEdit(
  phonemeTimings: PhonemeTiming[],
  phonemeTimingEditData: PhonemeTimingEditData,
  frameRate: number,
) {
  let phonemeIndexInNote = 0;
  for (let i = 0; i < phonemeTimings.length; i++) {
    const phonemeTiming = phonemeTimings[i];
    const prevPhonemeTiming = getPrev(phonemeTimings, i);
    const nextPhonemeTiming = getNext(phonemeTimings, i);

    if (
      prevPhonemeTiming == undefined ||
      phonemeTiming.noteId !== prevPhonemeTiming.noteId
    ) {
      phonemeIndexInNote = 0;
    } else {
      phonemeIndexInNote++;
    }

    if (phonemeTiming.phoneme === "pau") {
      continue;
    }
    if (phonemeTiming.noteId == undefined) {
      throw new Error("phonemeTiming.noteId is undefined.");
    }
    const phonemeTimingEdits = phonemeTimingEditData.get(phonemeTiming.noteId);
    if (phonemeTimingEdits == undefined) {
      continue;
    }
    for (const phonemeTimingEdit of phonemeTimingEdits) {
      if (phonemeTimingEdit.phonemeIndexInNote === phonemeIndexInNote) {
        const roundedOffsetFrame = secondToRoundedFrame(
          phonemeTimingEdit.offsetSeconds,
          frameRate,
        );

        phonemeTiming.startFrame += roundedOffsetFrame;
        if (prevPhonemeTiming != undefined) {
          prevPhonemeTiming.endFrame = phonemeTiming.startFrame;
        }
      } else if (
        phonemeTimingEdit.phonemeIndexInNote === phonemeIndexInNote + 1 &&
        nextPhonemeTiming?.phoneme === "pau"
      ) {
        // NOTE: フレーズ末尾のpauseはフレーズ最後のノートに含まれるものとして扱う
        const roundedOffsetFrame = secondToRoundedFrame(
          phonemeTimingEdit.offsetSeconds,
          frameRate,
        );

        phonemeTiming.endFrame += roundedOffsetFrame;
        nextPhonemeTiming.startFrame = phonemeTiming.endFrame;
      }
    }
  }
}

/**
 * 音素タイミングを調整する。
 *
 * - 各音素の長さが1フレーム以上になるように調整。
 * - 先頭のpauの開始フレームを0に設定。
 * - pauではない区間の開始フレーム（先頭のpauの終了フレーム）が最小開始フレーム以上になるように調整。
 * - pauではない区間の終了フレーム（末尾のpauの開始フレーム）が最大終了フレーム以下になるように調整。
 *   （余裕がない場合は最大終了フレームを超えるので注意）
 *
 * @param phonemeTimings - 音素タイミング列（先頭・末尾がpau）
 * @param minNonPauseStartFrame - pauではない区間（子音・母音の区間）の最小開始フレーム（1以上）
 * @param maxNonPauseEndFrame - pauではない区間（子音・母音の区間）の最大終了フレーム
 */
export function adjustPhonemeTimings(
  phonemeTimings: PhonemeTiming[],
  minNonPauseStartFrame: number | undefined,
  maxNonPauseEndFrame: number | undefined,
) {
  // 末尾のpauのタイミングを調整し、
  // 各音素のフレーム長が1以上になるように後方から調整する
  for (let i = phonemeTimings.length - 1; i >= 0; i--) {
    const phonemeTiming = phonemeTimings[i];
    const prevPhonemeTiming = getPrev(phonemeTimings, i);

    // 末尾のpauの場合
    if (i === phonemeTimings.length - 1) {
      // 開始フレームを制約内に収める
      // NOTE: 末尾のpauの開始フレーム＝pauではない区間の終了フレーム
      if (
        maxNonPauseEndFrame != undefined &&
        phonemeTiming.startFrame > maxNonPauseEndFrame
      ) {
        phonemeTiming.startFrame = maxNonPauseEndFrame;
      }
      // フレーム長が1以上になるように終了フレームを調整する
      if (phonemeTiming.endFrame <= phonemeTiming.startFrame) {
        phonemeTiming.endFrame = phonemeTiming.startFrame + 1;
      }
    }

    // 音素（pauを含む）のフレーム長が1以上になるように開始フレームを調整する
    if (phonemeTiming.startFrame >= phonemeTiming.endFrame) {
      phonemeTiming.startFrame = phonemeTiming.endFrame - 1;
    }
    if (prevPhonemeTiming != undefined) {
      prevPhonemeTiming.endFrame = phonemeTiming.startFrame;
    }
  }

  // 先頭のpauのタイミングを調整し、
  // 各音素のフレーム長が1以上になるように前方から調整する
  for (let i = 0; i < phonemeTimings.length; i++) {
    const phonemeTiming = phonemeTimings[i];
    const nextPhonemeTiming = getNext(phonemeTimings, i);

    // 先頭のpauの場合
    if (i === 0) {
      // 開始フレームを0に設定
      phonemeTiming.startFrame = 0;
      // 終了フレームを制限内に収める
      // NOTE: 先頭のpauの終了フレーム＝pauではない区間の開始フレーム
      if (
        minNonPauseStartFrame != undefined &&
        phonemeTiming.endFrame < minNonPauseStartFrame
      ) {
        phonemeTiming.endFrame = minNonPauseStartFrame;
      }
    }

    // 音素（pauを含む）のフレーム長が1以上になるように終了フレームを調整する
    if (phonemeTiming.startFrame >= phonemeTiming.endFrame) {
      phonemeTiming.endFrame = phonemeTiming.startFrame + 1;
    }
    if (nextPhonemeTiming != undefined) {
      nextPhonemeTiming.startFrame = phonemeTiming.endFrame;
    }
  }
}

/**
 * ユーザーによるピッチ編集データを、クエリのf0に適用する。
 * 単純な上書きではなく、編集箇所と未編集箇所の境界（つなぎ目）が自然になるように
 * スムージング処理も行う。
 *
 * @param phraseQuery - 適用対象のクエリ
 * @param phraseStartTime - フレーズの開始時刻（秒）
 * @param pitchEditData - ユーザーが編集したピッチデータの配列
 * @param editorFrameRate - エディターのフレームレート
 */
export function applyPitchEdit(
  phraseQuery: EditorFrameAudioQuery,
  phraseStartTime: number,
  pitchEditData: number[],
  editorFrameRate: number,
) {
  // フレーズクエリとエディターのフレームレートの不一致をチェック
  // TODO: 異なるフレームレート間での補間処理を実装する
  if (phraseQuery.frameRate !== editorFrameRate) {
    throw new Error(
      "The frame rate between the phrase query and the editor does not match.",
    );
  }

  const f0 = phraseQuery.f0;
  const phonemes = phraseQuery.phonemes;

  // 各フレームに対応する音素情報を生成
  const framePhonemes = convertToFramePhonemes(phonemes);
  if (f0.length !== framePhonemes.length) {
    throw new Error("f0.length and framePhonemes.length do not match.");
  }

  // フレーズの開始・終了フレーム（絶対時間軸）を計算
  const phraseQueryFrameLength = f0.length;
  const phraseQueryStartFrame = Math.round(
    phraseStartTime * phraseQuery.frameRate,
  );
  const phraseQueryEndFrame = phraseQueryStartFrame + phraseQueryFrameLength;

  // 有効なピッチが存在する範囲（f0 >= 1e-5）を抽出する
  // NOTE: 対数F0の計算で負無限大になるのを防ぐため、1e-5未満の値は無効とみなす
  const validPitchRanges: { startFrame: number; endFrame: number }[] = [];
  let currentStartFrame: number | undefined = undefined;
  for (
    let i = Math.max(0, phraseQueryStartFrame);
    i < phraseQueryEndFrame;
    i++
  ) {
    const f0Value = f0[i - phraseQueryStartFrame];

    if (f0Value >= 1e-5) {
      if (currentStartFrame == undefined) {
        currentStartFrame = i;
      }
    } else {
      if (currentStartFrame != undefined) {
        validPitchRanges.push({ startFrame: currentStartFrame, endFrame: i });
        currentStartFrame = undefined;
      }
    }
  }
  // 最後の区間を閉じる
  if (currentStartFrame != undefined) {
    validPitchRanges.push({
      startFrame: currentStartFrame,
      endFrame: phraseQueryEndFrame,
    });
  }

  // 各有効区間に対してピッチ編集処理を適用
  for (const validPitchRange of validPitchRanges) {
    const processStartFrame = validPitchRange.startFrame;
    const processEndFrame = validPitchRange.endFrame;

    const frameInfos: {
      isEdited: boolean;
      isVoiced: boolean;
    }[] = [];
    const logF0: number[] = [];

    // 元の（推論された）ピッチとの差分を格納する配列
    const logF0Diff: number[] = [];

    // 区間内の各フレーム情報を収集し、対数F0の差分を計算する
    for (let i = processStartFrame; i < processEndFrame; i++) {
      const indexInPhrase = i - phraseQueryStartFrame;
      const phoneme = framePhonemes[indexInPhrase];
      const isVoiced = !UNVOICED_PHONEMES.includes(phoneme);

      // NOTE: 無声区間、またはpitchEditDataの範囲外の場合は「データなし」として扱う
      let editValue = VALUE_INDICATING_NO_DATA;
      if (isVoiced && i < pitchEditData.length) {
        editValue = pitchEditData[i];
      }

      const isEdited = editValue !== VALUE_INDICATING_NO_DATA;
      const originalLogF0 = Math.log(f0[indexInPhrase]);

      frameInfos.push({ isEdited, isVoiced });
      logF0.push(originalLogF0);

      if (isEdited) {
        const editedLogF0 = Math.log(editValue);
        logF0Diff.push(editedLogF0 - originalLogF0);
      } else {
        logF0Diff.push(0);
      }
    }

    // 編集データが一つもない場合はスキップ
    const hasEditData = frameInfos.some((frameInfo) => frameInfo.isEdited);
    if (!hasEditData) {
      continue;
    }

    // 「編集済み」と「未編集」の境界を検出し、最大遷移長を計算する
    const editBoundaryIndices: number[] = [];
    const maxTransitionLengths: { left: number; right: number }[] = [];

    // デフォルトの遷移長（ミリ秒）
    // NOTE: 短すぎるとスムージングが十分にできず、長すぎると元のカーブを壊すため、60ms程度にしている
    const BASE_TRANSITION_LENGTH_MS = 60;

    // デフォルトの遷移長（フレーム数）
    const baseTransitionLength = Math.round(
      (BASE_TRANSITION_LENGTH_MS / 1000) * phraseQuery.frameRate,
    );

    for (let i = 0; i < frameInfos.length; i++) {
      const currentFrameInfo = frameInfos[i];
      const prevFrameInfo = getPrev(frameInfos, i);

      // 前フレームと編集状態が変わらない場合は境界ではない
      if (
        prevFrameInfo == undefined ||
        currentFrameInfo.isEdited === prevFrameInfo.isEdited
      ) {
        continue;
      }

      // 左右の最大遷移長の初期値
      let maxLeftTransitionLength = Math.floor(baseTransitionLength / 2);
      let maxRightTransitionLength = Math.floor(baseTransitionLength / 2);

      // しゃくりやフォールなどの歌唱表現を維持するため、
      // 可能な限りスムージングの遷移区間を有声区間から無声区間へ移動させる調整を行う。
      if (currentFrameInfo.isEdited) {
        // 「未編集」から「編集済み」への切り替わり
        // 左側（過去方向）にある無声区間を探し、遷移区間をそちらへ割り振る
        const prevIndex = i - 1;
        for (
          let distance = 0;
          distance < maxRightTransitionLength && prevIndex - distance >= 0;
          distance++
        ) {
          if (!frameInfos[prevIndex - distance].isVoiced) {
            // 右側の遷移長を短縮し、余った分を左側に追加する
            maxLeftTransitionLength += maxRightTransitionLength - distance;
            maxRightTransitionLength = distance;
            break;
          }
        }
      } else {
        // 「編集済み」から「未編集」への切り替わり
        // 右側（未来方向）にある無声区間を探し、遷移区間をそちらへ割り振る
        for (
          let distance = 0;
          distance < maxLeftTransitionLength &&
          i + distance < frameInfos.length;
          distance++
        ) {
          if (!frameInfos[i + distance].isVoiced) {
            // 左側の遷移長を短縮し、余った分を右側に追加する
            maxRightTransitionLength += maxLeftTransitionLength - distance;
            maxLeftTransitionLength = distance;
            break;
          }
        }
      }

      if (maxLeftTransitionLength !== 0 || maxRightTransitionLength !== 0) {
        editBoundaryIndices.push(i);
        maxTransitionLengths.push({
          left: maxLeftTransitionLength,
          right: maxRightTransitionLength,
        });
      }
    }

    // 計算された制約に基づいて滑らかな遷移を適用
    applySmoothTransitions(
      logF0Diff,
      editBoundaryIndices,
      maxTransitionLengths,
    );

    // 処理結果をphraseQuery.f0に書き戻す
    for (let i = 0; i < logF0.length; i++) {
      const processedLogF0 = logF0[i] + logF0Diff[i];

      const indexInPhrase = processStartFrame + i - phraseQueryStartFrame;
      phraseQuery.f0[indexInPhrase] = Math.exp(processedLogF0);
    }
  }
}

export function applyVolumeEdit(
  phraseQuery: EditorFrameAudioQuery,
  phraseStartTime: number,
  volumeEditData: number[],
  editorFrameRate: number,
) {
  if (phraseQuery.frameRate !== editorFrameRate) {
    throw new Error(
      "The frame rate between the phrase query and the editor does not match.",
    );
  }

  const volume = phraseQuery.volume;
  const phraseQueryFrameLength = volume.length;
  const phraseQueryStartFrame = Math.round(
    phraseStartTime * phraseQuery.frameRate,
  );
  const phraseQueryEndFrame = phraseQueryStartFrame + phraseQueryFrameLength;

  const startFrame = Math.max(0, phraseQueryStartFrame);
  const endFrame = Math.min(volumeEditData.length, phraseQueryEndFrame);
  for (let i = startFrame; i < endFrame; i++) {
    const editedVolume = volumeEditData[i];
    if (editedVolume === VALUE_INDICATING_NO_DATA) {
      continue;
    }
    // NOTE: ボリューム編集結果が負値になるケースに備えて0以上にクランプする
    volume[i - phraseQueryStartFrame] = Math.max(editedVolume, 0);
  }
}

/**
 * 文字列をモーラと非モーラに分割する。長音は展開される。連続する非モーラはまとめる。
 * 例："カナー漢字" -> ["カ", "ナ", "ア", "漢字"]
 *
 * @param text 分割する文字列
 * @param maxLength 最大の要素数
 * @returns 分割された文字列
 */
export const splitLyricsByMoras = (
  text: string,
  maxLength = Infinity,
): string[] => {
  const moraAndNonMoras: string[] = [];
  const matches = convertLongVowel(text).matchAll(moraPattern);
  let lastMatchEnd = 0;
  // aアbイウc で説明：
  for (const match of matches) {
    if (match.index == undefined) {
      throw new Error("match.index is undefined.");
    }
    // 直前のモーラとの間 = a、b、空文字列
    if (lastMatchEnd < match.index) {
      moraAndNonMoras.push(text.substring(lastMatchEnd, match.index));
    }
    // モーラ = ア、イ、ウ
    moraAndNonMoras.push(match[0]);
    lastMatchEnd = match.index + match[0].length;
  }
  // 最後のモーラから後 = cの部分
  if (lastMatchEnd < text.length) {
    moraAndNonMoras.push(text.substring(lastMatchEnd));
  }
  // 指定した最大要素数より多い場合は配列を削る
  if (moraAndNonMoras.length > maxLength) {
    moraAndNonMoras.splice(
      maxLength - 1,
      moraAndNonMoras.length,
      moraAndNonMoras.slice(maxLength - 1).join(""),
    );
  }
  return moraAndNonMoras;
};

/**
 * トラックのミュート・ソロ状態から再生すべきトラックを判定する。
 *
 * ソロのトラックが存在する場合は、ソロのトラックのみ再生する。（ミュートは無視される）
 * ソロのトラックが存在しない場合は、ミュートされていないトラックを再生する。
 */
export const shouldPlayTracks = (tracks: Map<TrackId, Track>): Set<TrackId> => {
  const soloTrackExists = [...tracks.values()].some((track) => track.solo);
  return new Set(
    [...tracks.entries()]
      .filter(([, track]) => (soloTrackExists ? track.solo : !track.mute))
      .map(([trackId]) => trackId),
  );
};

/*
 * ループ範囲が有効かどうかを判定する
 * @param startTick ループ開始位置(tick)
 * @param endTick ループ終了位置(tick)
 * @returns ループ範囲が有効な場合はtrue
 */
export const isValidLoopRange = (
  startTick: number,
  endTick: number,
): boolean => {
  return (
    startTick >= 0 &&
    endTick >= 0 &&
    Number.isInteger(startTick) &&
    Number.isInteger(endTick) &&
    startTick <= endTick // 範囲差0は許容する
  );
};
