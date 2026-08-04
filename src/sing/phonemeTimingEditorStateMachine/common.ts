import type { ComputedRef, Ref } from "vue";
import type { Store } from "@/store";
import type { StateDefinitions } from "@/sing/stateMachine";
import type { CursorState, ViewportInfo } from "@/sing/viewHelper";
import { NoteId, TrackId } from "@/type/preload";
import type { PhonemeTimingEditData, Tempo } from "@/domain/project/type";
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

// 音素タイミング編集のプレビューデータ
export type PhonemeTimingPreview =
  | {
      type: "move";
      noteId: NoteId;
      phonemeIndexInNote: number;
      offsetSeconds: number;
    }
  | {
      type: "erase";
      targets: {
        noteId: NoteId;
        phonemeIndexInNote: number;
      }[];
    };

// 音素タイミングの計算に必要なフレーズ情報
export type PhraseInfo = Readonly<{
  startTime: number;
  query?: EditorFrameAudioQuery;
  minNonPauseStartFrame: number | undefined;
  maxNonPauseEndFrame: number | undefined;
}>;

// 1音素分のタイミング情報
export type PhonemeTimingInfo = {
  phraseKey: PhraseKey;
  phoneme: string;
  noteId: NoteId | undefined;
  phonemeIndexInNote: number;
  isEdited: boolean;
  editedStartTimeSeconds: number;
  originalStartTimeSeconds: number;
  editedEndTimeSeconds: number;
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

export type PhonemeTimingEditorPreviewMode =
  | "IDLE"
  | "MOVE_PHONEME_TIMING"
  | "ERASE_PHONEME_TIMING";

export type PhonemeTimingEditorRefs = {
  readonly previewPhonemeTiming: Ref<PhonemeTimingPreview | undefined>;
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
  readonly phonemeTimingInfos: ComputedRef<PhonemeTimingInfo[]>;
  readonly phraseInfos: ComputedRef<Map<PhraseKey, PhraseInfo>>;
};

export type PhonemeTimingEditorPartialStore = {
  readonly state: Pick<
    Store["state"],
    | "tpqn"
    | "tempos"
    | "phrases"
    | "phraseQueries"
    | "editorFrameRate"
    | "sequencerPhonemeTimingTool"
  >;
  readonly getters: Pick<
    Store["getters"],
    "SELECTED_TRACK_ID" | "SELECTED_TRACK"
  >;
  readonly actions: Pick<
    Store["actions"],
    "COMMAND_UPSERT_PHONEME_TIMING_EDIT" | "COMMAND_ERASE_PHONEME_TIMING_EDITS"
  >;
};

export type PhonemeTimingEditorContext = PhonemeTimingEditorRefs &
  PhonemeTimingEditorComputedRefs & {
    readonly store: PhonemeTimingEditorPartialStore;
  };

export type PhonemeTimingEditorIdleStateId =
  | "movePhonemeTimingToolIdle"
  | "erasePhonemeTimingToolIdle";

export type PhonemeTimingEditorStateDefinitions = StateDefinitions<
  [
    {
      id: "movePhonemeTimingToolIdle";
      factoryArgs: undefined;
    },
    {
      id: "movePhonemeTiming";
      factoryArgs: {
        targetTrackId: TrackId;
        noteId: NoteId;
        phonemeIndexInNote: number;
        startPositionX: number;
        returnStateId: PhonemeTimingEditorIdleStateId;
      };
    },
    {
      id: "erasePhonemeTimingToolIdle";
      factoryArgs: undefined;
    },
    {
      id: "erasePhonemeTiming";
      factoryArgs: {
        targetTrackId: TrackId;
        startPositionX: number;
        returnStateId: PhonemeTimingEditorIdleStateId;
      };
    },
  ]
>;

/**
 * 指定トラックのフレーズ情報を取得する。
 */
export function getPhraseInfosForTrack(
  phrases: Map<PhraseKey, Phrase>,
  phraseQueries: Map<EditorFrameAudioQueryKey, EditorFrameAudioQuery>,
  trackId: TrackId,
): Map<PhraseKey, PhraseInfo> {
  const phraseInfos = new Map<PhraseKey, PhraseInfo>();
  for (const [phraseKey, phrase] of phrases) {
    if (phrase.trackId !== trackId) {
      continue;
    }
    let query = undefined;
    if (phrase.queryKey != undefined) {
      query = getOrThrow(phraseQueries, phrase.queryKey);
    }
    phraseInfos.set(phraseKey, {
      startTime: phrase.startTime,
      query,
      minNonPauseStartFrame: phrase.minNonPauseStartFrame,
      maxNonPauseEndFrame: phrase.maxNonPauseEndFrame,
    });
  }
  return phraseInfos;
}

/**
 * 音素タイミングの情報を計算する。
 */
export function computePhonemeTimingInfos(
  phraseInfos: Map<PhraseKey, PhraseInfo>,
  phonemeTimingEditData: PhonemeTimingEditData,
): PhonemeTimingInfo[] {
  // フレーズが時系列順に並んでいることを検証する
  let prevPhraseStartTime: number | undefined = undefined;
  for (const phraseInfo of phraseInfos.values()) {
    if (
      prevPhraseStartTime != undefined &&
      phraseInfo.startTime < prevPhraseStartTime
    ) {
      throw new Error("phraseInfos must be sorted in chronological order.");
    }
    prevPhraseStartTime = phraseInfo.startTime;
  }

  const phonemeTimingInfos: PhonemeTimingInfo[] = [];

  for (const [phraseKey, phraseInfo] of phraseInfos) {
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

    const phonemeIndices = computePhonemeIndicesInNote(phraseQuery.phonemes);

    let phonemeStartFrame = 0;
    let editedPhonemeStartFrame = 0;

    for (let i = 0; i < phraseQuery.phonemes.length; i++) {
      const phoneme = phraseQuery.phonemes[i];
      const prevPhoneme = getPrev(phraseQuery.phonemes, i);
      const editedPhoneme = editedPhonemes[i];
      const phonemeIndexInNote = phonemeIndices[i];

      const originalStartTimeSeconds =
        phraseStartTime + phonemeStartFrame / frameRate;
      const editedStartTimeSeconds =
        phraseStartTime + editedPhonemeStartFrame / frameRate;

      let noteId: NoteId | undefined;
      let effectivePhonemeIndexInNote: number;

      if (phoneme.phoneme === "pau") {
        if (prevPhoneme?.noteId != undefined) {
          // 末尾のpauは前のノートに含まれるものとして扱い、
          // 前の音素のnoteIdとphonemeIndexInNote + 1を使う
          noteId = NoteId(prevPhoneme.noteId);
          const prevPhonemeIndexInNote = phonemeIndices[i - 1];
          effectivePhonemeIndexInNote = prevPhonemeIndexInNote + 1;
        } else {
          // 先頭のpauなどはノートに属さない
          noteId = undefined;
          effectivePhonemeIndexInNote = phonemeIndexInNote;
        }
      } else {
        noteId =
          phoneme.noteId != undefined ? NoteId(phoneme.noteId) : undefined;
        effectivePhonemeIndexInNote = phonemeIndexInNote;
      }

      // 編集が存在するかどうかを判定
      let isEdited = false;
      if (noteId != undefined) {
        const phonemeTimingEdits = phonemeTimingEditData.get(noteId);
        if (phonemeTimingEdits != undefined) {
          isEdited = phonemeTimingEdits.some(
            (edit) => edit.phonemeIndexInNote === effectivePhonemeIndexInNote,
          );
        }
      }

      const editedEndTimeSeconds =
        phraseStartTime +
        (editedPhonemeStartFrame + editedPhoneme.frameLength) / frameRate;

      phonemeTimingInfos.push({
        phraseKey,
        noteId,
        phonemeIndexInNote: effectivePhonemeIndexInNote,
        phoneme: phoneme.phoneme,
        isEdited,
        originalStartTimeSeconds,
        editedStartTimeSeconds,
        editedEndTimeSeconds,
      });

      phonemeStartFrame += phoneme.frameLength;
      editedPhonemeStartFrame += editedPhoneme.frameLength;
    }
  }

  return phonemeTimingInfos;
}
