import { ComputedRef, Ref } from "vue";
import type { Store } from "@/store";
import { StateDefinitions } from "@/sing/stateMachine";
import { type CursorState, type ViewportInfo } from "@/sing/viewHelper";
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

// フレーズ情報（StateMachine用）
export type PhraseInfo = Readonly<{
  startTime: number;
  query?: EditorFrameAudioQuery;
  notes: Note[];
  minNonPauseStartFrame: number | undefined;
  maxNonPauseEndFrame: number | undefined;
}>;

// 音素タイミング情報
export type PhonemeTimingInfo = {
  phraseKey: PhraseKey;
  phoneme: string;
  noteId: NoteId | undefined;
  phonemeIndexInNote: number;
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
 * 指定トラックのフレーズ情報を取得する
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
      notes: phrase.notes,
      minNonPauseStartFrame: phrase.minNonPauseStartFrame,
      maxNonPauseEndFrame: phrase.maxNonPauseEndFrame,
    });
  }
  return phraseInfos;
}

/**
 * 音素タイミングの情報を計算する
 */
export function computePhonemeTimingInfos(
  phraseInfos: Map<PhraseKey, PhraseInfo>,
  phonemeTimingEditData: PhonemeTimingEditData,
): PhonemeTimingInfo[] {
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

      // 編集前の開始時刻
      const originalStartTimeSeconds =
        phraseStartTime + phonemeStartFrame / frameRate;
      // 編集・調整後の開始時刻
      const editedStartTimeSeconds =
        phraseStartTime + editedPhonemeStartFrame / frameRate;

      // noteIdとphonemeIndexInNoteを取得
      let noteId: NoteId | undefined;
      let effectivePhonemeIndexInNote: number;

      if (phoneme.phoneme === "pau") {
        if (prevPhoneme?.noteId != undefined) {
          // 末尾pau: 前の音素のnoteIdとphonemeIndexInNote + 1を使う（前のノートに含まれるものとして扱う）
          noteId = NoteId(prevPhoneme.noteId);
          const prevPhonemeIndexInNote = phonemeIndices[i - 1];
          effectivePhonemeIndexInNote = prevPhonemeIndexInNote + 1;
        } else {
          // 先頭pauなど: noteIdはundefined
          noteId = undefined;
          effectivePhonemeIndexInNote = phonemeIndexInNote;
        }
      } else {
        noteId =
          phoneme.noteId != undefined ? NoteId(phoneme.noteId) : undefined;
        effectivePhonemeIndexInNote = phonemeIndexInNote;
      }

      // 現在の音素の終了時刻 = 次の音素の開始時刻
      const editedEndTimeSeconds =
        phraseStartTime +
        (editedPhonemeStartFrame + editedPhoneme.frameLength) / frameRate;

      phonemeTimingInfos.push({
        phraseKey,
        noteId,
        phonemeIndexInNote: effectivePhonemeIndexInNote,
        phoneme: editedPhoneme.phoneme,
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
