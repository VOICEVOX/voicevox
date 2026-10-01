import type { NoteId } from "@/type/preload";
import type {
  PhonemeTimingInfo,
  PhonemeTimingPreview,
} from "@/song/phonemeTimingEditorStateMachine/common";
import { getNext } from "@/song/utility";

/** 画面に表示する音素境界の位置と状態 */
export type PhonemeBoundaryDisplay = PhonemeTimingInfo & {
  noteId: NoteId;
  /** プレビューを反映し、前後の境界と順序が入れ替わらないよう制限した開始時刻 */
  displayStartTimeSeconds: number;
  displayState: "default" | "edited" | "movePreview";
};

/**
 * 1つのノートに属する音素境界と、そのノートの音素帯の範囲
 * 境界には末尾の休符も含むが、帯の範囲には含まない
 */
export type NotePhonemeBand = {
  noteId: NoteId;
  boundaries: PhonemeBoundaryDisplay[];
  startTimeSeconds: number;
  endTimeSeconds: number;
};

/**
 * 音素タイミング情報から、画面に表示する音素境界を求める
 * ドラッグ中や消去中のプレビューを開始時刻と状態に反映する
 */
export function buildPhonemeBoundaryDisplays(
  infos: readonly PhonemeTimingInfo[],
  preview: PhonemeTimingPreview | undefined,
  editorFrameRate: number,
): PhonemeBoundaryDisplay[] {
  const result: PhonemeBoundaryDisplay[] = [];
  for (const info of infos) {
    // 先頭のpauには操作対象のノートがないため表示しない
    if (info.noteId == undefined) continue;
    const isMovePreview =
      preview?.type === "move" &&
      preview.noteId === info.noteId &&
      preview.phonemeIndexInNote === info.phonemeIndexInNote;
    const isErasePreview =
      preview?.type === "erase" &&
      preview.targets.some(
        (target) =>
          target.noteId === info.noteId &&
          target.phonemeIndexInNote === info.phonemeIndexInNote,
      );
    result.push({
      ...info,
      noteId: info.noteId,
      displayStartTimeSeconds: isErasePreview
        ? info.originalStartTimeSeconds
        : isMovePreview
          ? info.originalStartTimeSeconds + preview.offsetSeconds
          : info.editedStartTimeSeconds,
      displayState: isMovePreview
        ? "movePreview"
        : info.isEdited && !isErasePreview
          ? "edited"
          : "default",
    });
  }
  // 消去プレビューで編集前の位置に戻すと隣の境界を越えることがあるため、
  // 表示上は次の境界の1フレーム手前に留めて順序を保つ
  for (let i = result.length - 1; i >= 0; i--) {
    const next = getNext(result, i);
    if (next != undefined) {
      result[i].displayStartTimeSeconds = Math.min(
        result[i].displayStartTimeSeconds,
        next.displayStartTimeSeconds - 1 / editorFrameRate,
      );
    }
  }
  return result;
}

/**
 * 表示する音素境界をノートごとにまとめ、音素帯の範囲を求める
 * 帯は、次のノートの最初の境界・末尾の休符の開始・フレーズの終わりのいずれかで閉じる
 */
export function buildNotePhonemeBands(
  boundaries: readonly PhonemeBoundaryDisplay[],
): NotePhonemeBand[] {
  const bands: NotePhonemeBand[] = [];
  for (const [i, boundary] of boundaries.entries()) {
    const next = getNext(boundaries, i);
    const endTimeSeconds =
      boundary.phoneme === "pau"
        ? boundary.displayStartTimeSeconds
        : next?.phraseKey === boundary.phraseKey
          ? next.displayStartTimeSeconds
          : boundary.editedEndTimeSeconds;
    const band = bands.at(-1);
    if (band?.noteId === boundary.noteId) {
      band.boundaries.push(boundary);
      band.endTimeSeconds = endTimeSeconds;
    } else {
      bands.push({
        noteId: boundary.noteId,
        boundaries: [boundary],
        startTimeSeconds: boundary.displayStartTimeSeconds,
        endTimeSeconds,
      });
    }
  }
  return bands;
}
