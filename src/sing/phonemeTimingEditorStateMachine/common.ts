import { ComputedRef, Ref } from "vue";
import type { Store } from "@/store";
import { StateDefinitions } from "@/sing/stateMachine";
import {
  tickToBaseX,
  type CursorState,
  type ViewportInfo,
} from "@/sing/viewHelper";
import { NoteId, TrackId } from "@/type/preload";
import type { Note, PhonemeTimingEditData, Tempo } from "@/domain/project/type";
import type {
  EditorFrameAudioQuery,
  EditorFrameAudioQueryKey,
  Phrase,
  PhraseKey,
} from "@/store/type";
import { getOrThrow } from "@/helpers/mapHelper";
import {
  adjustPhonemeTimings,
  applyPhonemeTimingEdit,
  computePhonemeIndicesInNote,
  toPhonemes,
  toPhonemeTimings,
} from "@/sing/domain";
import { getPrev } from "@/sing/utility";
import { secondToTick } from "@/sing/music";

// 音素タイミング編集のプレビューデータ
export type PhonemeTimingPreviewEdit = {
  noteId: NoteId;
  phonemeIndexInNote: number;
  offsetSeconds: number;
};

// フレーズ情報（StateMachine用）
type PhraseInfo = Readonly<{
  startTime: number;
  query?: EditorFrameAudioQuery;
  notes: Note[];
  minNonPauseStartFrame: number | undefined;
  maxNonPauseEndFrame: number | undefined;
}>;

// 音素タイミング線情報（StateMachine内部用、ヒットテスト用）
type PhonemeTimingLineInfo = {
  pixelX: number;
  phoneme: string;
  noteId: NoteId;
  phonemeIndexInNote: number;
  editedStartTimeSeconds: number;
  originalStartTimeSeconds: number;
  hasExistingEdit: boolean;
  minTimeSeconds: number;
  maxTimeSeconds: number;
};

export type PhonemeTimingEditorInput =
  | {
      readonly type: "pointerEvent";
      readonly targetArea: "PhonemeTimingArea";
      readonly pointerEvent: PointerEvent;
      readonly positionX: number;
    }
  | {
      readonly type: "pointerEvent";
      readonly targetArea: "Window";
      readonly pointerEvent: PointerEvent;
      readonly positionX: number;
    };

export type PhonemeTimingEditorPreviewMode = "IDLE" | "PHONEME_TIMING_EDIT";

export type PhonemeTimingEditorRefs = {
  readonly previewPhonemeTimingEdit: Ref<PhonemeTimingPreviewEdit | undefined>;
  readonly previewMode: Ref<PhonemeTimingEditorPreviewMode>;
  readonly cursorState: Ref<CursorState>;
};

export type PhonemeTimingEditorComputedRefs = {
  readonly selectedTrackId: ComputedRef<TrackId>;
  readonly tempos: ComputedRef<Tempo[]>;
  readonly tpqn: ComputedRef<number>;
  readonly viewportInfo: ComputedRef<ViewportInfo>;
  readonly phonemeTimingEditData: ComputedRef<PhonemeTimingEditData>;
  readonly editorFrameRate: ComputedRef<number>;
};

export type PhonemeTimingEditorPartialStore = {
  readonly state: Pick<
    Store["state"],
    "tpqn" | "tempos" | "phrases" | "phraseQueries" | "editorFrameRate"
  >;
  readonly getters: Pick<
    Store["getters"],
    "SELECTED_TRACK_ID" | "SELECTED_TRACK"
  >;
  readonly actions: Pick<
    Store["actions"],
    "COMMAND_ADD_PHONEME_TIMING_EDITS" | "COMMAND_UPDATE_PHONEME_TIMING_EDITS"
  >;
};

export type PhonemeTimingEditorContext = PhonemeTimingEditorRefs &
  PhonemeTimingEditorComputedRefs & {
    readonly store: PhonemeTimingEditorPartialStore;
  };

export type PhonemeTimingEditorIdleStateId = "phonemeTimingEditToolIdle";

export type PhonemeTimingEditorStateDefinitions = StateDefinitions<
  [
    {
      id: "phonemeTimingEditToolIdle";
      factoryArgs: undefined;
    },
    {
      id: "phonemeTimingEdit";
      factoryArgs: {
        targetTrackId: TrackId;
        noteId: NoteId;
        phonemeIndexInNote: number;
        initialStartTimeSeconds: number;
        initialOffsetSeconds: number;
        hasExistingEdit: boolean;
        minTimeSeconds: number;
        maxTimeSeconds: number;
        startPositionX: number;
        returnStateId: PhonemeTimingEditorIdleStateId;
      };
    },
  ]
>;

/**
 * 指定トラックのフレーズ情報を取得する
 */
export function getPhraseInfosForTrack(
  phrases: Map<PhraseKey, Phrase>,
  phraseQueries: Map<EditorFrameAudioQueryKey, EditorFrameAudioQuery>,
  trackId: TrackId,
): PhraseInfo[] {
  const phraseInfos: PhraseInfo[] = [];
  for (const phrase of phrases.values()) {
    if (phrase.trackId !== trackId) {
      continue;
    }
    let query = undefined;
    if (phrase.queryKey != undefined) {
      query = getOrThrow(phraseQueries, phrase.queryKey);
    }
    phraseInfos.push({
      startTime: phrase.startTime,
      query,
      notes: phrase.notes,
      minNonPauseStartFrame: phrase.minNonPauseStartFrame,
      maxNonPauseEndFrame: phrase.maxNonPauseEndFrame,
    });
  }
  return phraseInfos;
}

/**
 * 音素タイミング線の情報を計算する
 */
export function computePhonemeTimingLineInfos(
  phraseInfos: PhraseInfo[],
  phonemeTimingEditData: PhonemeTimingEditData,
  tempos: Tempo[],
  tpqn: number,
  viewportInfo: ViewportInfo,
): PhonemeTimingLineInfo[] {
  const lineInfos: PhonemeTimingLineInfo[] = [];

  for (const phraseInfo of phraseInfos) {
    const phraseQuery = phraseInfo.query;
    if (phraseQuery == undefined) {
      continue;
    }

    // 編集を適用した音素列を生成
    const phonemeTimings = toPhonemeTimings(phraseQuery.phonemes);
    applyPhonemeTimingEdit(
      phonemeTimings,
      phonemeTimingEditData,
      phraseQuery.frameRate,
    );
    adjustPhonemeTimings(
      phonemeTimings,
      phraseInfo.minNonPauseStartFrame,
      phraseInfo.maxNonPauseEndFrame,
    );
    const editedPhonemes = toPhonemes(phonemeTimings);

    const phraseStartTime = phraseInfo.startTime;
    const frameRate = phraseQuery.frameRate;

    // phonemeIndexInNoteを計算
    const phonemeIndices = computePhonemeIndicesInNote(phraseQuery.phonemes);

    // フレーズ内の各音素について処理
    let phonemeStartFrame = 0;
    let editedPhonemeStartFrame = 0;

    for (let i = 0; i < phraseQuery.phonemes.length; i++) {
      const phoneme = phraseQuery.phonemes[i];
      const prevPhoneme = getPrev(phraseQuery.phonemes, i);
      const editedPhoneme = editedPhonemes[i];
      const phonemeIndexInNote = phonemeIndices[i];

      // 子音・母音とフレーズ最後のpauを対象とする
      if (
        phoneme.phoneme !== "pau" ||
        (prevPhoneme != undefined && prevPhoneme.phoneme !== "pau")
      ) {
        // 編集前の開始時刻
        const originalStartTimeSeconds =
          phraseStartTime + phonemeStartFrame / frameRate;
        // 編集・調整後の開始時刻
        const editedStartTimeSeconds =
          phraseStartTime + editedPhonemeStartFrame / frameRate;

        // ピクセルX座標を計算
        const phonemeStartTicks = secondToTick(
          editedStartTimeSeconds,
          tempos,
          tpqn,
        );
        const phonemeStartBaseX = tickToBaseX(phonemeStartTicks, tpqn);
        const pixelX = Math.round(
          phonemeStartBaseX * viewportInfo.scaleX - viewportInfo.offsetX,
        );

        // noteIdとphonemeIndexInNoteを取得
        // 末尾pauの場合は前の音素の情報を使う（前のノートに含まれるものとして扱う）
        let noteId: NoteId | undefined;
        let effectivePhonemeIndexInNote: number;

        if (phoneme.phoneme === "pau") {
          // 末尾pau: 前の音素のnoteIdとphonemeIndexInNote + 1を使う
          if (prevPhoneme != undefined && prevPhoneme.noteId != undefined) {
            noteId = NoteId(prevPhoneme.noteId);
            const prevPhonemeIndexInNote = phonemeIndices[i - 1];
            effectivePhonemeIndexInNote = prevPhonemeIndexInNote + 1;
          } else {
            noteId = undefined;
            effectivePhonemeIndexInNote = phonemeIndexInNote;
          }
        } else {
          noteId =
            phoneme.noteId != undefined ? NoteId(phoneme.noteId) : undefined;
          effectivePhonemeIndexInNote = phonemeIndexInNote;
        }

        if (noteId != undefined) {
          // 対応する編集データが存在するかを確認
          const phonemeTimingEdits = phonemeTimingEditData.get(noteId);
          const existingEdit = phonemeTimingEdits?.find(
            (edit) => edit.phonemeIndexInNote === effectivePhonemeIndexInNote,
          );
          const hasExistingEdit = existingEdit != undefined;

          // 前の音素の時間からminを計算
          const prevEditedPhoneme = getPrev(editedPhonemes, i);

          let minTimeSeconds = phraseStartTime;
          if (prevEditedPhoneme != undefined) {
            // 前の音素の開始フレーム = 現在の音素の開始フレーム - 前の音素のフレーム長
            const prevStartFrame =
              editedPhonemeStartFrame - prevEditedPhoneme.frameLength;
            minTimeSeconds = phraseStartTime + prevStartFrame / frameRate;
          }

          // 現在の音素の終了時刻 = 次の音素の開始時刻
          const maxTimeSeconds =
            phraseStartTime +
            (editedPhonemeStartFrame + editedPhoneme.frameLength) / frameRate;

          lineInfos.push({
            pixelX,
            phoneme: editedPhoneme.phoneme,
            noteId,
            phonemeIndexInNote: effectivePhonemeIndexInNote,
            editedStartTimeSeconds,
            originalStartTimeSeconds,
            hasExistingEdit,
            minTimeSeconds,
            maxTimeSeconds,
          });
        }
      }

      phonemeStartFrame += phoneme.frameLength;
      editedPhonemeStartFrame += editedPhoneme.frameLength;
    }
  }

  return lineInfos;
}

/**
 * クリック位置から最寄りの音素タイミング線を見つける
 */
export function findNearestPhonemeTimingLine(
  lineInfos: PhonemeTimingLineInfo[],
  positionX: number,
  threshold: number,
): PhonemeTimingLineInfo | undefined {
  let nearestLine: PhonemeTimingLineInfo | undefined;
  let minDistance = Infinity;

  for (const lineInfo of lineInfos) {
    const distance = Math.abs(lineInfo.pixelX - positionX);
    if (distance < minDistance && distance <= threshold) {
      minDistance = distance;
      nearestLine = lineInfo;
    }
  }

  return nearestLine;
}
