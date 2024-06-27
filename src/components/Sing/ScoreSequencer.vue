<template>
  <div class="score-sequencer">
    <!-- 左上の角 -->
    <div class="sequencer-corner"></div>
    <!-- ルーラー -->
    <SequencerRuler class="sequencer-ruler" :offset="scrollX" :numMeasures />
    <!-- 鍵盤 -->
    <SequencerKeys
      class="sequencer-keys"
      :offset="scrollY"
      :blackKeyWidth="28"
    />
    <!-- シーケンサ -->
    <div
      ref="sequencerBody"
      class="sequencer-body"
      :class="{
        'rect-selecting': editTarget === 'NOTE' && shiftKey,
        'cursor-draw': editTarget === 'PITCH' && !ctrlKey,
      }"
      aria-label="シーケンサ"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
      @wheel="onWheel"
      @scroll="onScroll"
      @contextmenu.prevent
    >
      <!-- キャラクター全身 -->
      <CharacterPortrait />
      <!-- グリッド -->
      <SequencerGrid />
      <div
        v-if="editTarget === 'NOTE' && showGuideLine"
        class="sequencer-guideline"
        :style="{
          height: `${gridHeight}px`,
          transform: `translateX(${guideLineX}px)`,
        }"
      ></div>
      <!-- undefinedだと警告が出るのでnullを渡す -->
      <SequencerNote
        v-for="note in editTarget === 'NOTE'
          ? notesIncludingPreviewNotes
          : notes"
        :key="note.id"
        :note
        :nowPreviewing
        :isSelected="selectedNoteIds.has(note.id)"
        :isPreview="previewNoteIds.has(note.id)"
        :previewLyric="previewLyrics.get(note.id) || null"
        @barMousedown="onNoteBarMouseDown($event, note)"
        @barDoubleClick="onNoteBarDoubleClick($event, note)"
        @leftEdgeMousedown="onNoteLeftEdgeMouseDown($event, note)"
        @rightEdgeMousedown="onNoteRightEdgeMouseDown($event, note)"
      />
      <SequencerLyricInput
        v-if="editingLyricNote != undefined"
        :editingLyricNote
        @lyricInput="onLyricInput"
        @lyricConfirmed="onLyricConfirmed"
      />
    </div>
    <SequencerPitch
      v-if="editTarget === 'PITCH'"
      class="sequencer-pitch"
      :style="{
        marginRight: `${scrollBarWidth}px`,
        marginBottom: `${scrollBarWidth}px`,
      }"
      :offsetX="scrollX"
      :offsetY="scrollY"
      :previewPitchEdit
    />
    <div
      class="sequencer-overlay"
      :style="{
        marginRight: `${scrollBarWidth}px`,
        marginBottom: `${scrollBarWidth}px`,
      }"
    >
      <div
        ref="rectSelectHitbox"
        class="rect-select-preview"
        :style="{
          display: isRectSelecting ? 'block' : 'none',
          left: `${Math.min(rectSelectStartX, cursorX)}px`,
          top: `${Math.min(rectSelectStartY, cursorY)}px`,
          width: `${Math.abs(cursorX - rectSelectStartX)}px`,
          height: `${Math.abs(cursorY - rectSelectStartY)}px`,
        }"
      ></div>
      <SequencerPhraseIndicator
        v-for="phraseInfo in phraseInfos"
        :key="phraseInfo.key"
        :phraseKey="phraseInfo.key"
        class="sequencer-phrase-indicator"
        :style="{
          width: `${phraseInfo.width}px`,
          transform: `translateX(${phraseInfo.x - scrollX}px)`,
        }"
      />
      <div
        class="sequencer-playhead"
        data-testid="sequencer-playhead"
        :style="{
          transform: `translateX(${playheadX - scrollX}px)`,
        }"
      ></div>
    </div>
    <QSlider
      :modelValue="zoomX"
      :min="ZOOM_X_MIN"
      :max="ZOOM_X_MAX"
      :step="ZOOM_X_STEP"
      class="zoom-x-slider"
      @update:modelValue="setZoomX"
    />
    <QSlider
      :modelValue="zoomY"
      :min="ZOOM_Y_MIN"
      :max="ZOOM_Y_MAX"
      :step="ZOOM_Y_STEP"
      vertical
      reverse
      class="zoom-y-slider"
      @update:modelValue="setZoomY"
    />
    <ContextMenu
      v-if="editTarget === 'NOTE'"
      ref="contextMenu"
      :menudata="contextMenuData"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
  nextTick,
  onMounted,
  onActivated,
  onDeactivated,
} from "vue";
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu.vue";
import { NoteId } from "@/type/preload";
import { useStore } from "@/store";
import { Note, SequencerEditTarget } from "@/store/type";
import {
  getEndTicksOfPhrase,
  getNoteDuration,
  getStartTicksOfPhrase,
  noteNumberToFrequency,
  tickToSecond,
} from "@/sing/domain";
import {
  getKeyBaseHeight,
  tickToBaseX,
  baseXToTick,
  noteNumberToBaseY,
  baseYToNoteNumber,
  keyInfos,
  getDoremiFromNoteNumber,
  ZOOM_X_MIN,
  ZOOM_X_MAX,
  ZOOM_X_STEP,
  ZOOM_Y_MIN,
  ZOOM_Y_MAX,
  ZOOM_Y_STEP,
  PREVIEW_SOUND_DURATION,
  getButton,
} from "@/sing/viewHelper";
import SequencerGrid from "@/components/Sing/SequencerGrid.vue";
import SequencerRuler from "@/components/Sing/SequencerRuler.vue";
import SequencerKeys from "@/components/Sing/SequencerKeys.vue";
import SequencerNote from "@/components/Sing/SequencerNote.vue";
import SequencerPhraseIndicator from "@/components/Sing/SequencerPhraseIndicator.vue";
import CharacterPortrait from "@/components/Sing/CharacterPortrait.vue";
import SequencerPitch from "@/components/Sing/SequencerPitch.vue";
import SequencerLyricInput from "@/components/Sing/SequencerLyricInput.vue";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";
import { createLogger } from "@/domain/frontend/log";
import { useHotkeyManager } from "@/plugins/hotkeyPlugin";
import {
  useCommandOrControlKey,
  useShiftKey,
} from "@/composables/useModifierKey";
import { applyGaussianFilter, linearInterpolation } from "@/sing/utility";
import { useLyricInput } from "@/composables/useLyricInput";
import { ExhaustiveError } from "@/type/utility";

type PreviewMode =
  | "ADD_NOTE"
  | "MOVE_NOTE"
  | "RESIZE_NOTE_RIGHT"
  | "RESIZE_NOTE_LEFT"
  | "DRAW_PITCH"
  | "ERASE_PITCH";

// 直接イベントが来ているかどうか
const isSelfEventTarget = (event: UIEvent) => {
  return event.target === event.currentTarget;
};

const { warn } = createLogger("ScoreSequencer");
const store = useStore();
const state = store.state;

// TPQN、テンポ、ノーツ
const tpqn = computed(() => state.tpqn);
const tempos = computed(() => state.tempos);
const notes = computed(() => store.getters.SELECTED_TRACK.notes);
const selectedNoteIds = computed(() => new Set(state.selectedNoteIds));
const isNoteSelected = computed(() => {
  return selectedNoteIds.value.size > 0;
});
const selectedNotes = computed(() => {
  return notes.value.filter((value) => selectedNoteIds.value.has(value.id));
});
const notesIncludingPreviewNotes = computed(() => {
  if (nowPreviewing.value) {
    const previewNoteIds = new Set(previewNotes.value.map((value) => value.id));
    return previewNotes.value
      .concat(notes.value.filter((value) => !previewNoteIds.has(value.id)))
      .sort((a, b) => {
        const aIsSelectedOrPreview =
          selectedNoteIds.value.has(a.id) || previewNoteIds.has(a.id);
        const bIsSelectedOrPreview =
          selectedNoteIds.value.has(b.id) || previewNoteIds.has(b.id);
        if (aIsSelectedOrPreview === bIsSelectedOrPreview) {
          return a.position - b.position;
        } else {
          // 「プレビュー中か選択中のノート」が「選択されていないノート」より
          // 手前に表示されるようにする
          return aIsSelectedOrPreview ? 1 : -1;
        }
      });
  } else {
    return [...notes.value].sort((a, b) => {
      const aIsSelected = selectedNoteIds.value.has(a.id);
      const bIsSelected = selectedNoteIds.value.has(b.id);
      if (aIsSelected === bIsSelected) {
        return a.position - b.position;
      } else {
        // 「選択中のノート」が「選択されていないノート」より手前に表示されるようにする
        return aIsSelected ? 1 : -1;
      }
    });
  }
});

// 矩形選択
const shiftKey = useShiftKey();
const isRectSelecting = ref(false);
const rectSelectStartX = ref(0);
const rectSelectStartY = ref(0);
const rectSelectHitbox = ref<HTMLElement | undefined>(undefined);

// ズーム状態
const zoomX = computed(() => state.sequencerZoomX);
const zoomY = computed(() => state.sequencerZoomY);

// スナップ
const snapTicks = computed(() => {
  return getNoteDuration(state.sequencerSnapType, tpqn.value);
});

// グリッド
const gridCellBaseHeight = getKeyBaseHeight();
const gridHeight = computed(() => {
  return gridCellBaseHeight * zoomY.value * keyInfos.length;
});

// 小節の数
const numMeasures = computed(() => {
  return store.getters.SEQUENCER_NUM_MEASURES;
});

// スクロール位置
const scrollX = ref(0);
const scrollY = ref(0);

// 再生ヘッドの位置
const playheadTicks = ref(0);
const playheadX = computed(() => {
  const baseX = tickToBaseX(playheadTicks.value, tpqn.value);
  return Math.floor(baseX * zoomX.value);
});

// フレーズ
const phraseInfos = computed(() => {
  return [...state.phrases.entries()].map(([key, phrase]) => {
    const startTicks = getStartTicksOfPhrase(phrase);
    const endTicks = getEndTicksOfPhrase(phrase);
    const startBaseX = tickToBaseX(startTicks, tpqn.value);
    const endBaseX = tickToBaseX(endTicks, tpqn.value);
    const startX = startBaseX * zoomX.value;
    const endX = endBaseX * zoomX.value;
    return { key, x: startX, width: endX - startX };
  });
});

const ctrlKey = useCommandOrControlKey();
const editTarget = computed(() => state.sequencerEditTarget);
const editFrameRate = computed(() => state.editFrameRate);
const scrollBarWidth = ref(12);
const sequencerBody = ref<HTMLElement | null>(null);

// マウスカーソル位置
const cursorX = ref(0);
const cursorY = ref(0);

// 歌詞入力
const { previewLyrics, commitPreviewLyrics, splitAndUpdatePreview } =
  useLyricInput();

const onLyricInput = (text: string, note: Note) => {
  splitAndUpdatePreview(text, note);
};

const onLyricConfirmed = (nextNoteId: NoteId | undefined) => {
  commitPreviewLyrics();
  store.dispatch("SET_EDITING_LYRIC_NOTE_ID", { noteId: nextNoteId });
};

// プレビュー
// FIXME: 関連する値を１つのobjectにまとめる
const nowPreviewing = ref(false);
let previewMode: PreviewMode = "ADD_NOTE";
let previewRequestId = 0;
let previewStartEditTarget: SequencerEditTarget = "NOTE";
let executePreviewProcess = false;
// ノート編集のプレビュー
// プレビュー中に更新（移動やリサイズ等）されるノーツ
const previewNotes = ref<Note[]>([]);
// プレビュー中に変更されない（プレビュー前の状態を保持する）ノーツ
const copiedNotesForPreview = new Map<NoteId, Note>();
const previewNoteIds = computed(() => {
  return new Set(nowPreviewing.value ? copiedNotesForPreview.keys() : []);
});
let dragStartTicks = 0;
let dragStartNoteNumber = 0;
let dragStartGuideLineTicks = 0;
let draggingNoteId = NoteId(""); // FIXME: 無効状態はstring以外の型にする
let edited = false; // プレビュー終了時にstore.stateの更新を行うかどうかを表す変数
// ピッチ編集のプレビュー
const previewPitchEdit = ref<
  | { type: "draw"; data: number[]; startFrame: number }
  | { type: "erase"; startFrame: number; frameLength: number }
  | undefined
>(undefined);
const prevCursorPos = { frame: 0, frequency: 0 }; // 前のカーソル位置

// 歌詞を編集中のノート
const editingLyricNote = computed(() => {
  return notes.value.find((value) => value.id === state.editingLyricNoteId);
});

// 入力を補助する線
const showGuideLine = ref(true);
const guideLineX = ref(0);

const previewAdd = () => {
  const cursorBaseX = (scrollX.value + cursorX.value) / zoomX.value;
  const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
  const draggingNote = copiedNotesForPreview.get(draggingNoteId);
  if (!draggingNote) {
    throw new Error("draggingNote is undefined.");
  }
  const dragTicks = cursorTicks - dragStartTicks;
  const noteDuration =
    Math.round(dragTicks / snapTicks.value) * snapTicks.value;
  const noteEndPos = draggingNote.position + noteDuration;

  const editedNotes = new Map<NoteId, Note>();
  for (const note of previewNotes.value) {
    const copiedNote = copiedNotesForPreview.get(note.id);
    if (!copiedNote) {
      throw new Error("copiedNote is undefined.");
    }
    const duration = Math.max(snapTicks.value, noteDuration);
    if (note.duration !== duration) {
      editedNotes.set(note.id, { ...note, duration });
    }
  }
  if (editedNotes.size !== 0) {
    previewNotes.value = previewNotes.value.map((value) => {
      return editedNotes.get(value.id) ?? value;
    });
  }

  const guideLineBaseX = tickToBaseX(noteEndPos, tpqn.value);
  guideLineX.value = guideLineBaseX * zoomX.value;
};

const previewMove = () => {
  const cursorBaseX = (scrollX.value + cursorX.value) / zoomX.value;
  const cursorBaseY = (scrollY.value + cursorY.value) / zoomY.value;
  const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
  const cursorNoteNumber = baseYToNoteNumber(cursorBaseY);
  const draggingNote = copiedNotesForPreview.get(draggingNoteId);
  if (!draggingNote) {
    throw new Error("draggingNote is undefined.");
  }
  const dragTicks = cursorTicks - dragStartTicks;
  const notePos = draggingNote.position;
  const newNotePos =
    Math.round((notePos + dragTicks) / snapTicks.value) * snapTicks.value;
  const movingTicks = newNotePos - notePos;
  const movingSemitones = cursorNoteNumber - dragStartNoteNumber;

  const editedNotes = new Map<NoteId, Note>();
  for (const note of previewNotes.value) {
    const copiedNote = copiedNotesForPreview.get(note.id);
    if (!copiedNote) {
      throw new Error("copiedNote is undefined.");
    }
    const position = copiedNote.position + movingTicks;
    const noteNumber = copiedNote.noteNumber + movingSemitones;
    if (note.position !== position || note.noteNumber !== noteNumber) {
      editedNotes.set(note.id, { ...note, noteNumber, position });
    }
  }
  for (const note of editedNotes.values()) {
    if (note.noteNumber < 0 || note.noteNumber >= keyInfos.length) {
      // MIDIキー範囲外へはドラッグしない
      return;
    }

    if (note.position < 0) {
      // 左端より前はドラッグしない
      return;
    }
  }
  if (editedNotes.size !== 0) {
    previewNotes.value = previewNotes.value.map((value) => {
      return editedNotes.get(value.id) ?? value;
    });
    edited = true;
  }

  const guideLineBaseX = tickToBaseX(
    dragStartGuideLineTicks + movingTicks,
    tpqn.value,
  );
  guideLineX.value = guideLineBaseX * zoomX.value;
};

const previewResizeRight = () => {
  const cursorBaseX = (scrollX.value + cursorX.value) / zoomX.value;
  const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
  const draggingNote = copiedNotesForPreview.get(draggingNoteId);
  if (!draggingNote) {
    throw new Error("draggingNote is undefined.");
  }
  const dragTicks = cursorTicks - dragStartTicks;
  const noteEndPos = draggingNote.position + draggingNote.duration;
  const newNoteEndPos =
    Math.round((noteEndPos + dragTicks) / snapTicks.value) * snapTicks.value;
  const movingTicks = newNoteEndPos - noteEndPos;

  const editedNotes = new Map<NoteId, Note>();
  for (const note of previewNotes.value) {
    const copiedNote = copiedNotesForPreview.get(note.id);
    if (!copiedNote) {
      throw new Error("copiedNote is undefined.");
    }
    const notePos = copiedNote.position;
    const noteEndPos = copiedNote.position + copiedNote.duration;
    const duration = Math.max(
      snapTicks.value,
      noteEndPos + movingTicks - notePos,
    );
    if (note.duration !== duration) {
      editedNotes.set(note.id, { ...note, duration });
    }
  }
  if (editedNotes.size !== 0) {
    previewNotes.value = previewNotes.value.map((value) => {
      return editedNotes.get(value.id) ?? value;
    });
    edited = true;
  }

  const guideLineBaseX = tickToBaseX(newNoteEndPos, tpqn.value);
  guideLineX.value = guideLineBaseX * zoomX.value;
};

const previewResizeLeft = () => {
  const cursorBaseX = (scrollX.value + cursorX.value) / zoomX.value;
  const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
  const draggingNote = copiedNotesForPreview.get(draggingNoteId);
  if (!draggingNote) {
    throw new Error("draggingNote is undefined.");
  }
  const dragTicks = cursorTicks - dragStartTicks;
  const notePos = draggingNote.position;
  const newNotePos =
    Math.round((notePos + dragTicks) / snapTicks.value) * snapTicks.value;
  const movingTicks = newNotePos - notePos;

  const editedNotes = new Map<NoteId, Note>();
  for (const note of previewNotes.value) {
    const copiedNote = copiedNotesForPreview.get(note.id);
    if (!copiedNote) {
      throw new Error("copiedNote is undefined.");
    }
    const notePos = copiedNote.position;
    const noteEndPos = copiedNote.position + copiedNote.duration;
    const position = Math.min(
      noteEndPos - snapTicks.value,
      notePos + movingTicks,
    );
    const duration = noteEndPos - position;
    if (note.position !== position && note.duration !== duration) {
      editedNotes.set(note.id, { ...note, position, duration });
    }
  }
  for (const note of editedNotes.values()) {
    if (note.position < 0) {
      // 左端より前はドラッグしない
      return;
    }
  }
  if (editedNotes.size !== 0) {
    previewNotes.value = previewNotes.value.map((value) => {
      return editedNotes.get(value.id) ?? value;
    });
    edited = true;
  }

  const guideLineBaseX = tickToBaseX(newNotePos, tpqn.value);
  guideLineX.value = guideLineBaseX * zoomX.value;
};

// ピッチを描く処理を行う
const previewDrawPitch = () => {
  if (previewPitchEdit.value == undefined) {
    throw new Error("previewPitchEdit.value is undefined.");
  }
  if (previewPitchEdit.value.type !== "draw") {
    throw new Error("previewPitchEdit.value.type is not draw.");
  }
  const frameRate = editFrameRate.value;
  const cursorBaseX = (scrollX.value + cursorX.value) / zoomX.value;
  const cursorBaseY = (scrollY.value + cursorY.value) / zoomY.value;
  const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
  const cursorSeconds = tickToSecond(cursorTicks, tempos.value, tpqn.value);
  const cursorFrame = Math.round(cursorSeconds * frameRate);
  const cursorNoteNumber = baseYToNoteNumber(cursorBaseY, false);
  const cursorFrequency = noteNumberToFrequency(cursorNoteNumber);
  if (cursorFrame < 0) {
    return;
  }
  const tempPitchEdit = {
    ...previewPitchEdit.value,
    data: [...previewPitchEdit.value.data],
  };

  if (cursorFrame < tempPitchEdit.startFrame) {
    const numOfFramesToUnshift = tempPitchEdit.startFrame - cursorFrame;
    tempPitchEdit.data = new Array(numOfFramesToUnshift)
      .fill(0)
      .concat(tempPitchEdit.data);
    tempPitchEdit.startFrame = cursorFrame;
  }

  const lastFrame = tempPitchEdit.startFrame + tempPitchEdit.data.length - 1;
  if (cursorFrame > lastFrame) {
    const numOfFramesToPush = cursorFrame - lastFrame;
    tempPitchEdit.data = tempPitchEdit.data.concat(
      new Array(numOfFramesToPush).fill(0),
    );
  }

  if (cursorFrame === prevCursorPos.frame) {
    const i = cursorFrame - tempPitchEdit.startFrame;
    tempPitchEdit.data[i] = cursorFrequency;
  } else if (cursorFrame < prevCursorPos.frame) {
    for (let i = cursorFrame; i <= prevCursorPos.frame; i++) {
      tempPitchEdit.data[i - tempPitchEdit.startFrame] = Math.exp(
        linearInterpolation(
          cursorFrame,
          Math.log(cursorFrequency),
          prevCursorPos.frame,
          Math.log(prevCursorPos.frequency),
          i,
        ),
      );
    }
  } else {
    for (let i = prevCursorPos.frame; i <= cursorFrame; i++) {
      tempPitchEdit.data[i - tempPitchEdit.startFrame] = Math.exp(
        linearInterpolation(
          prevCursorPos.frame,
          Math.log(prevCursorPos.frequency),
          cursorFrame,
          Math.log(cursorFrequency),
          i,
        ),
      );
    }
  }

  previewPitchEdit.value = tempPitchEdit;
  prevCursorPos.frame = cursorFrame;
  prevCursorPos.frequency = cursorFrequency;
};

// ドラッグした範囲のピッチ編集データを消去する処理を行う
const previewErasePitch = () => {
  if (previewPitchEdit.value == undefined) {
    throw new Error("previewPitchEdit.value is undefined.");
  }
  if (previewPitchEdit.value.type !== "erase") {
    throw new Error("previewPitchEdit.value.type is not erase.");
  }
  const frameRate = editFrameRate.value;
  const cursorBaseX = (scrollX.value + cursorX.value) / zoomX.value;
  const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
  const cursorSeconds = tickToSecond(cursorTicks, tempos.value, tpqn.value);
  const cursorFrame = Math.round(cursorSeconds * frameRate);
  if (cursorFrame < 0) {
    return;
  }
  const tempPitchEdit = { ...previewPitchEdit.value };

  if (tempPitchEdit.startFrame > cursorFrame) {
    tempPitchEdit.frameLength += tempPitchEdit.startFrame - cursorFrame;
    tempPitchEdit.startFrame = cursorFrame;
  }

  const lastFrame = tempPitchEdit.startFrame + tempPitchEdit.frameLength - 1;
  if (lastFrame < cursorFrame) {
    tempPitchEdit.frameLength += cursorFrame - lastFrame;
  }

  previewPitchEdit.value = tempPitchEdit;
  prevCursorPos.frame = cursorFrame;
};

const preview = () => {
  if (executePreviewProcess) {
    if (previewMode === "ADD_NOTE") {
      previewAdd();
    }
    if (previewMode === "MOVE_NOTE") {
      previewMove();
    }
    if (previewMode === "RESIZE_NOTE_RIGHT") {
      previewResizeRight();
    }
    if (previewMode === "RESIZE_NOTE_LEFT") {
      previewResizeLeft();
    }
    if (previewMode === "DRAW_PITCH") {
      previewDrawPitch();
    }
    if (previewMode === "ERASE_PITCH") {
      previewErasePitch();
    }
    executePreviewProcess = false;
  }
  previewRequestId = requestAnimationFrame(preview);
};

const getXInBorderBox = (clientX: number, element: HTMLElement) => {
  return clientX - element.getBoundingClientRect().left;
};

const getYInBorderBox = (clientY: number, element: HTMLElement) => {
  return clientY - element.getBoundingClientRect().top;
};

const selectOnlyThis = (note: Note) => {
  store.dispatch("DESELECT_ALL_NOTES");
  store.dispatch("SELECT_NOTES", { noteIds: [note.id] });
  store.dispatch("PLAY_PREVIEW_SOUND", {
    noteNumber: note.noteNumber,
    duration: PREVIEW_SOUND_DURATION,
  });
};

const startPreview = (event: MouseEvent, mode: PreviewMode, note?: Note) => {
  if (nowPreviewing.value) {
    warn("startPreview was called during preview.");
    return;
  }
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  cursorX.value = getXInBorderBox(event.clientX, sequencerBodyElement);
  cursorY.value = getYInBorderBox(event.clientY, sequencerBodyElement);
  if (cursorX.value >= sequencerBodyElement.clientWidth) {
    return;
  }
  if (cursorY.value >= sequencerBodyElement.clientHeight) {
    return;
  }
  const cursorBaseX = (scrollX.value + cursorX.value) / zoomX.value;
  const cursorBaseY = (scrollY.value + cursorY.value) / zoomY.value;

  if (editTarget.value === "NOTE") {
    // 編集ターゲットがノートのときの処理

    const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
    const cursorNoteNumber = baseYToNoteNumber(cursorBaseY, true);
    // NOTE: 入力を補助する線の判定の境目はスナップ幅の3/4の位置
    const guideLineTicks =
      Math.round(cursorTicks / snapTicks.value - 0.25) * snapTicks.value;
    const copiedNotes: Note[] = [];
    if (mode === "ADD_NOTE") {
      if (cursorNoteNumber < 0) {
        return;
      }
      note = {
        id: NoteId(crypto.randomUUID()),
        position: guideLineTicks,
        duration: snapTicks.value,
        noteNumber: cursorNoteNumber,
        lyric: getDoremiFromNoteNumber(cursorNoteNumber),
      };
      store.dispatch("DESELECT_ALL_NOTES");
      copiedNotes.push(note);
    } else {
      if (!note) {
        throw new Error("note is undefined.");
      }
      if (event.shiftKey) {
        let minIndex = notes.value.length - 1;
        let maxIndex = 0;
        for (let i = 0; i < notes.value.length; i++) {
          const noteId = notes.value[i].id;
          if (state.selectedNoteIds.has(noteId) || noteId === note.id) {
            minIndex = Math.min(minIndex, i);
            maxIndex = Math.max(maxIndex, i);
          }
        }
        const noteIdsToSelect: NoteId[] = [];
        for (let i = minIndex; i <= maxIndex; i++) {
          const noteId = notes.value[i].id;
          if (!state.selectedNoteIds.has(noteId)) {
            noteIdsToSelect.push(noteId);
          }
        }
        store.dispatch("SELECT_NOTES", { noteIds: noteIdsToSelect });
      } else if (isOnCommandOrCtrlKeyDown(event)) {
        store.dispatch("SELECT_NOTES", { noteIds: [note.id] });
      } else if (!state.selectedNoteIds.has(note.id)) {
        selectOnlyThis(note);
      }
      for (const note of selectedNotes.value) {
        copiedNotes.push({ ...note });
      }
    }
    dragStartTicks = cursorTicks;
    dragStartNoteNumber = cursorNoteNumber;
    dragStartGuideLineTicks = guideLineTicks;
    draggingNoteId = note.id;
    edited = mode === "ADD_NOTE";
    copiedNotesForPreview.clear();
    for (const copiedNote of copiedNotes) {
      copiedNotesForPreview.set(copiedNote.id, copiedNote);
    }
    previewNotes.value = copiedNotes;
  } else if (editTarget.value === "PITCH") {
    // 編集ターゲットがピッチのときの処理

    const frameRate = editFrameRate.value;
    const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
    const cursorSeconds = tickToSecond(cursorTicks, tempos.value, tpqn.value);
    const cursorFrame = Math.round(cursorSeconds * frameRate);
    const cursorNoteNumber = baseYToNoteNumber(cursorBaseY, false);
    const cursorFrequency = noteNumberToFrequency(cursorNoteNumber);
    if (mode === "DRAW_PITCH") {
      previewPitchEdit.value = {
        type: "draw",
        data: [cursorFrequency],
        startFrame: cursorFrame,
      };
    } else if (mode === "ERASE_PITCH") {
      previewPitchEdit.value = {
        type: "erase",
        startFrame: cursorFrame,
        frameLength: 1,
      };
    } else {
      throw new Error("Unknown preview mode.");
    }
    prevCursorPos.frame = cursorFrame;
    prevCursorPos.frequency = cursorFrequency;
  } else {
    throw new ExhaustiveError(editTarget.value);
  }
  previewMode = mode;
  previewStartEditTarget = editTarget.value;
  executePreviewProcess = true;
  nowPreviewing.value = true;
  previewRequestId = requestAnimationFrame(preview);
};

const endPreview = () => {
  cancelAnimationFrame(previewRequestId);
  if (previewStartEditTarget === "NOTE") {
    // 編集ターゲットがノートのときにプレビューを開始した場合の処理

    if (edited) {
      if (previewMode === "ADD_NOTE") {
        store.dispatch("COMMAND_ADD_NOTES", { notes: previewNotes.value });
        store.dispatch("SELECT_NOTES", {
          noteIds: previewNotes.value.map((value) => value.id),
        });
      } else {
        store.dispatch("COMMAND_UPDATE_NOTES", { notes: previewNotes.value });
      }
      if (previewNotes.value.length === 1) {
        store.dispatch("PLAY_PREVIEW_SOUND", {
          noteNumber: previewNotes.value[0].noteNumber,
          duration: PREVIEW_SOUND_DURATION,
        });
      }
    }
  } else if (previewStartEditTarget === "PITCH") {
    // 編集ターゲットがピッチのときにプレビューを開始した場合の処理

    if (previewPitchEdit.value == undefined) {
      throw new Error("previewPitchEdit.value is undefined.");
    }
    const previewPitchEditType = previewPitchEdit.value.type;
    if (previewPitchEditType === "draw") {
      // カーソルを動かさずにマウスのボタンを離したときに1フレームのみの変更になり、
      // 1フレームの変更はピッチ編集ラインとして表示されないので、無視する
      if (previewPitchEdit.value.data.length >= 2) {
        // 平滑化を行う
        let data = previewPitchEdit.value.data;
        data = data.map((value) => Math.log(value));
        applyGaussianFilter(data, 0.7);
        data = data.map((value) => Math.exp(value));

        store.dispatch("COMMAND_SET_PITCH_EDIT_DATA", {
          data,
          startFrame: previewPitchEdit.value.startFrame,
        });
      }
    } else if (previewPitchEditType === "erase") {
      store.dispatch("COMMAND_ERASE_PITCH_EDIT_DATA", {
        startFrame: previewPitchEdit.value.startFrame,
        frameLength: previewPitchEdit.value.frameLength,
      });
    } else {
      throw new ExhaustiveError(previewPitchEditType);
    }
    previewPitchEdit.value = undefined;
  } else {
    throw new ExhaustiveError(previewStartEditTarget);
  }
  nowPreviewing.value = false;
};

const onNoteBarMouseDown = (event: MouseEvent, note: Note) => {
  if (editTarget.value !== "NOTE" || !isSelfEventTarget(event)) {
    return;
  }
  const mouseButton = getButton(event);
  if (mouseButton === "LEFT_BUTTON") {
    startPreview(event, "MOVE_NOTE", note);
  } else if (!state.selectedNoteIds.has(note.id)) {
    selectOnlyThis(note);
  }
};

const onNoteBarDoubleClick = (event: MouseEvent, note: Note) => {
  if (editTarget.value !== "NOTE") {
    return;
  }
  const mouseButton = getButton(event);
  if (mouseButton === "LEFT_BUTTON" && note.id !== state.editingLyricNoteId) {
    store.dispatch("SET_EDITING_LYRIC_NOTE_ID", { noteId: note.id });
  }
};

const onNoteLeftEdgeMouseDown = (event: MouseEvent, note: Note) => {
  if (editTarget.value !== "NOTE" || !isSelfEventTarget(event)) {
    return;
  }
  const mouseButton = getButton(event);
  if (mouseButton === "LEFT_BUTTON") {
    startPreview(event, "RESIZE_NOTE_LEFT", note);
  } else if (!state.selectedNoteIds.has(note.id)) {
    selectOnlyThis(note);
  }
};

const onNoteRightEdgeMouseDown = (event: MouseEvent, note: Note) => {
  if (editTarget.value !== "NOTE" || !isSelfEventTarget(event)) {
    return;
  }
  const mouseButton = getButton(event);
  if (mouseButton === "LEFT_BUTTON") {
    startPreview(event, "RESIZE_NOTE_RIGHT", note);
  } else if (!state.selectedNoteIds.has(note.id)) {
    selectOnlyThis(note);
  }
};

const onMouseDown = (event: MouseEvent) => {
  if (editTarget.value === "NOTE" && !isSelfEventTarget(event)) {
    return;
  }
  const mouseButton = getButton(event);
  // TODO: メニューが表示されている場合はメニュー非表示のみ行いたい
  if (editTarget.value === "NOTE") {
    if (mouseButton === "LEFT_BUTTON") {
      if (event.shiftKey) {
        isRectSelecting.value = true;
        rectSelectStartX.value = cursorX.value;
        rectSelectStartY.value = cursorY.value;
      } else {
        startPreview(event, "ADD_NOTE");
      }
    } else {
      store.dispatch("DESELECT_ALL_NOTES");
    }
  } else if (editTarget.value === "PITCH") {
    if (mouseButton === "LEFT_BUTTON") {
      if (isOnCommandOrCtrlKeyDown(event)) {
        startPreview(event, "ERASE_PITCH");
      } else {
        startPreview(event, "DRAW_PITCH");
      }
    }
  } else {
    throw new ExhaustiveError(editTarget.value);
  }
};

const onMouseMove = (event: MouseEvent) => {
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  cursorX.value = getXInBorderBox(event.clientX, sequencerBodyElement);
  cursorY.value = getYInBorderBox(event.clientY, sequencerBodyElement);

  if (nowPreviewing.value) {
    executePreviewProcess = true;
  } else {
    const scrollLeft = sequencerBodyElement.scrollLeft;
    const cursorBaseX = (scrollLeft + cursorX.value) / zoomX.value;
    const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
    // NOTE: 入力を補助する線の判定の境目はスナップ幅の3/4の位置
    const guideLineTicks =
      Math.round(cursorTicks / snapTicks.value - 0.25) * snapTicks.value;
    const guideLineBaseX = tickToBaseX(guideLineTicks, tpqn.value);
    guideLineX.value = guideLineBaseX * zoomX.value;
  }
};

const onMouseUp = (event: MouseEvent) => {
  const mouseButton = getButton(event);
  if (mouseButton !== "LEFT_BUTTON") {
    return;
  }
  if (isRectSelecting.value) {
    rectSelect(isOnCommandOrCtrlKeyDown(event));
  } else if (nowPreviewing.value) {
    endPreview();
  }
};

/**
 * 矩形選択。
 * @param additive 追加選択とするかどうか。
 */
const rectSelect = (additive: boolean) => {
  const rectSelectHitboxElement = rectSelectHitbox.value;
  if (!rectSelectHitboxElement) {
    throw new Error("rectSelectHitboxElement is null.");
  }
  isRectSelecting.value = false;
  const left = Math.min(rectSelectStartX.value, cursorX.value);
  const top = Math.min(rectSelectStartY.value, cursorY.value);
  const width = Math.abs(cursorX.value - rectSelectStartX.value);
  const height = Math.abs(cursorY.value - rectSelectStartY.value);
  const startTicks = baseXToTick(
    (scrollX.value + left) / zoomX.value,
    tpqn.value,
  );
  const endTicks = baseXToTick(
    (scrollX.value + left + width) / zoomX.value,
    tpqn.value,
  );
  const endNoteNumber = baseYToNoteNumber((scrollY.value + top) / zoomY.value);
  const startNoteNumber = baseYToNoteNumber(
    (scrollY.value + top + height) / zoomY.value,
  );

  const noteIdsToSelect: NoteId[] = [];
  for (const note of notes.value) {
    if (
      note.position + note.duration >= startTicks &&
      note.position <= endTicks &&
      startNoteNumber <= note.noteNumber &&
      note.noteNumber <= endNoteNumber
    ) {
      noteIdsToSelect.push(note.id);
    }
  }
  if (!additive) {
    store.dispatch("DESELECT_ALL_NOTES");
  }
  store.dispatch("SELECT_NOTES", { noteIds: noteIdsToSelect });
};

const onMouseEnter = () => {
  showGuideLine.value = true;
};

const onMouseLeave = () => {
  showGuideLine.value = false;
};

// キーボードイベント
const handleNotesArrowUp = () => {
  const editedNotes: Note[] = [];
  for (const note of selectedNotes.value) {
    const noteNumber = Math.min(note.noteNumber + 1, 127);
    editedNotes.push({ ...note, noteNumber });
  }
  if (editedNotes.some((note) => note.noteNumber > 127)) {
    return;
  }
  store.dispatch("COMMAND_UPDATE_NOTES", { notes: editedNotes });

  if (editedNotes.length === 1) {
    store.dispatch("PLAY_PREVIEW_SOUND", {
      noteNumber: editedNotes[0].noteNumber,
      duration: PREVIEW_SOUND_DURATION,
    });
  }
};

const handleNotesArrowDown = () => {
  const editedNotes: Note[] = [];
  for (const note of selectedNotes.value) {
    const noteNumber = Math.max(note.noteNumber - 1, 0);
    editedNotes.push({ ...note, noteNumber });
  }
  if (editedNotes.some((note) => note.noteNumber < 0)) {
    return;
  }
  store.dispatch("COMMAND_UPDATE_NOTES", { notes: editedNotes });

  if (editedNotes.length === 1) {
    store.dispatch("PLAY_PREVIEW_SOUND", {
      noteNumber: editedNotes[0].noteNumber,
      duration: PREVIEW_SOUND_DURATION,
    });
  }
};

const handleNotesArrowRight = () => {
  const editedNotes: Note[] = [];
  for (const note of selectedNotes.value) {
    const position = note.position + snapTicks.value;
    editedNotes.push({ ...note, position });
  }
  if (editedNotes.length === 0) {
    // TODO: 例外処理は`UPDATE_NOTES`内に移す？
    return;
  }
  store.dispatch("COMMAND_UPDATE_NOTES", { notes: editedNotes });
};

const handleNotesArrowLeft = () => {
  const editedNotes: Note[] = [];
  for (const note of selectedNotes.value) {
    const position = note.position - snapTicks.value;
    editedNotes.push({ ...note, position });
  }
  if (
    editedNotes.length === 0 ||
    editedNotes.some((note) => note.position < 0)
  ) {
    return;
  }
  store.dispatch("COMMAND_UPDATE_NOTES", { notes: editedNotes });
};

const handleNotesBackspaceOrDelete = () => {
  if (state.selectedNoteIds.size === 0) {
    // TODO: 例外処理は`COMMAND_REMOVE_SELECTED_NOTES`内に移す？
    return;
  }
  store.dispatch("COMMAND_REMOVE_SELECTED_NOTES");
};

const handleKeydown = (event: KeyboardEvent) => {
  // プレビュー中の操作は想定外の挙動をしそうなので防止
  if (nowPreviewing.value) {
    return;
  }
  switch (event.key) {
    case "ArrowUp":
      handleNotesArrowUp();
      break;
    case "ArrowDown":
      handleNotesArrowDown();
      break;
    case "ArrowRight":
      handleNotesArrowRight();
      break;
    case "ArrowLeft":
      handleNotesArrowLeft();
      break;
    case "Backspace":
      handleNotesBackspaceOrDelete();
      break;
    case "Delete":
      handleNotesBackspaceOrDelete();
      break;
    case "Escape":
      store.dispatch("DESELECT_ALL_NOTES");
      break;
  }
};

// X軸ズーム
const setZoomX = (value: number | null) => {
  if (value == null) {
    return;
  }
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  // 画面の中央を基準に水平方向のズームを行う
  const oldZoomX = zoomX.value;
  const newZoomX = value;
  const scrollLeft = sequencerBodyElement.scrollLeft;
  const scrollTop = sequencerBodyElement.scrollTop;
  const clientWidth = sequencerBodyElement.clientWidth;

  store.dispatch("SET_ZOOM_X", { zoomX: newZoomX }).then(() => {
    const centerBaseX = (scrollLeft + clientWidth / 2) / oldZoomX;
    const newScrollLeft = centerBaseX * newZoomX - clientWidth / 2;
    sequencerBodyElement.scrollTo(newScrollLeft, scrollTop);
  });
};

// Y軸ズーム
const setZoomY = (value: number | null) => {
  if (value == null) {
    return;
  }
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  // 画面の中央を基準に垂直方向のズームを行う
  const oldZoomY = zoomY.value;
  const newZoomY = value;
  const scrollLeft = sequencerBodyElement.scrollLeft;
  const scrollTop = sequencerBodyElement.scrollTop;
  const clientHeight = sequencerBodyElement.clientHeight;

  store.dispatch("SET_ZOOM_Y", { zoomY: newZoomY }).then(() => {
    const centerBaseY = (scrollTop + clientHeight / 2) / oldZoomY;
    const newScrollTop = centerBaseY * newZoomY - clientHeight / 2;
    sequencerBodyElement.scrollTo(scrollLeft, newScrollTop);
  });
};

const onWheel = (event: WheelEvent) => {
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  if (isOnCommandOrCtrlKeyDown(event)) {
    // scrollイベントの発火を阻止する
    event.preventDefault();

    cursorX.value = getXInBorderBox(event.clientX, sequencerBodyElement);
    // マウスカーソル位置を基準に水平方向のズームを行う
    const oldZoomX = zoomX.value;
    let newZoomX = zoomX.value;
    newZoomX -= event.deltaY * (ZOOM_X_STEP * 0.01);
    newZoomX = Math.min(ZOOM_X_MAX, newZoomX);
    newZoomX = Math.max(ZOOM_X_MIN, newZoomX);
    const scrollLeft = sequencerBodyElement.scrollLeft;
    const scrollTop = sequencerBodyElement.scrollTop;
    guideLineX.value = 0; // 補助線がはみ出さないように位置を一旦0にする

    store.dispatch("SET_ZOOM_X", { zoomX: newZoomX }).then(() => {
      const cursorBaseX = (scrollLeft + cursorX.value) / oldZoomX;
      const newScrollLeft = cursorBaseX * newZoomX - cursorX.value;
      sequencerBodyElement.scrollTo(newScrollLeft, scrollTop);
    });
  }
};

const onScroll = (event: Event) => {
  if (event.target instanceof HTMLElement) {
    scrollX.value = event.target.scrollLeft;
    scrollY.value = event.target.scrollTop;
  }
};

const playheadPositionChangeListener = (position: number) => {
  playheadTicks.value = position;

  // オートスクロール
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  const scrollLeft = sequencerBodyElement.scrollLeft;
  const scrollTop = sequencerBodyElement.scrollTop;
  const scrollWidth = sequencerBodyElement.scrollWidth;
  const clientWidth = sequencerBodyElement.clientWidth;
  const playheadX = tickToBaseX(position, tpqn.value) * zoomX.value;
  const tolerance = 3;
  if (playheadX < scrollLeft) {
    sequencerBodyElement.scrollTo(playheadX, scrollTop);
  } else if (
    scrollLeft < scrollWidth - clientWidth - tolerance &&
    playheadX >= scrollLeft + clientWidth
  ) {
    sequencerBodyElement.scrollTo(playheadX, scrollTop);
  }
};

// スクロールバーの幅を取得する
onMounted(() => {
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  const clientWidth = sequencerBodyElement.clientWidth;
  const offsetWidth = sequencerBodyElement.offsetWidth;
  scrollBarWidth.value = offsetWidth - clientWidth;
});

// 最初のonActivatedか判断するためのフラグ
let firstActivation = true;

// スクロール位置を設定する
onActivated(() => {
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  let xToScroll = 0;
  let yToScroll = 0;
  if (firstActivation) {
    // 初期スクロール位置を設定（C4が上から2/3の位置になるようにする）
    const clientHeight = sequencerBodyElement.clientHeight;
    const c4BaseY = noteNumberToBaseY(60);
    const clientBaseHeight = clientHeight / zoomY.value;
    const scrollBaseY = c4BaseY - clientBaseHeight * (2 / 3);
    xToScroll = 0;
    yToScroll = scrollBaseY * zoomY.value;

    firstActivation = false;
  } else {
    // スクロール位置を復帰
    xToScroll = scrollX.value;
    yToScroll = scrollY.value;
  }
  // 実際にスクロールする
  nextTick(() => {
    sequencerBodyElement.scrollTo(xToScroll, yToScroll);
  });
});

// リスナー登録
onActivated(() => {
  store.dispatch("ADD_PLAYHEAD_POSITION_CHANGE_LISTENER", {
    listener: playheadPositionChangeListener,
  });

  document.addEventListener("keydown", handleKeydown);
});

// リスナー解除
onDeactivated(() => {
  store.dispatch("REMOVE_PLAYHEAD_POSITION_CHANGE_LISTENER", {
    listener: playheadPositionChangeListener,
  });

  document.removeEventListener("keydown", handleKeydown);
});

// コンテキストメニュー
// TODO: 分割する
const { registerHotkeyWithCleanup } = useHotkeyManager();

registerHotkeyWithCleanup({
  editor: "song",
  name: "コピー",
  callback: () => {
    if (nowPreviewing.value) {
      return;
    }
    if (state.selectedNoteIds.size === 0) {
      return;
    }
    store.dispatch("COPY_NOTES_TO_CLIPBOARD");
  },
});

registerHotkeyWithCleanup({
  editor: "song",
  name: "切り取り",
  callback: () => {
    if (nowPreviewing.value) {
      return;
    }
    if (state.selectedNoteIds.size === 0) {
      return;
    }
    store.dispatch("COMMAND_CUT_NOTES_TO_CLIPBOARD");
  },
});

registerHotkeyWithCleanup({
  editor: "song",
  name: "貼り付け",
  callback: () => {
    if (nowPreviewing.value) {
      return;
    }
    store.dispatch("COMMAND_PASTE_NOTES_FROM_CLIPBOARD");
  },
});

registerHotkeyWithCleanup({
  editor: "song",
  name: "すべて選択",
  callback: () => {
    if (nowPreviewing.value) {
      return;
    }
    store.dispatch("SELECT_ALL_NOTES");
  },
});

const contextMenu = ref<InstanceType<typeof ContextMenu>>();

const contextMenuData = computed<ContextMenuItemData[]>(() => {
  return [
    {
      type: "button",
      label: "コピー",
      onClick: async () => {
        contextMenu.value?.hide();
        await store.dispatch("COPY_NOTES_TO_CLIPBOARD");
      },
      disabled: !isNoteSelected.value,
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "切り取り",
      onClick: async () => {
        contextMenu.value?.hide();
        await store.dispatch("COMMAND_CUT_NOTES_TO_CLIPBOARD");
      },
      disabled: !isNoteSelected.value,
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "貼り付け",
      onClick: async () => {
        contextMenu.value?.hide();
        await store.dispatch("COMMAND_PASTE_NOTES_FROM_CLIPBOARD");
      },
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: "すべて選択",
      onClick: async () => {
        contextMenu.value?.hide();
        await store.dispatch("SELECT_ALL_NOTES");
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "選択解除",
      onClick: async () => {
        contextMenu.value?.hide();
        await store.dispatch("DESELECT_ALL_NOTES");
      },
      disabled: !isNoteSelected.value,
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: "クオンタイズ",
      onClick: async () => {
        contextMenu.value?.hide();
        await store.dispatch("COMMAND_QUANTIZE_SELECTED_NOTES");
      },
      disabled: !isNoteSelected.value,
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: "削除",
      onClick: async () => {
        contextMenu.value?.hide();
        await store.dispatch("COMMAND_REMOVE_SELECTED_NOTES");
      },
      disabled: !isNoteSelected.value,
      disableWhenUiLocked: true,
    },
  ];
});
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.score-sequencer {
  backface-visibility: hidden;
  display: grid;
  grid-template-rows: 30px 1fr;
  grid-template-columns: 48px 1fr;
}

.sequencer-corner {
  grid-row: 1;
  grid-column: 1;
  background: colors.$background;
  border-top: 1px solid colors.$sequencer-sub-divider;
  border-bottom: 1px solid colors.$sequencer-sub-divider;
}

.sequencer-ruler {
  grid-row: 1;
  grid-column: 2;
}

.sequencer-keys {
  grid-row: 2;
  grid-column: 1;
}

.sequencer-body {
  grid-row: 2;
  grid-column: 2;
  backface-visibility: hidden;
  overflow: auto;
  position: relative;

  &.rect-selecting {
    cursor: crosshair;
  }
}

.sequencer-guideline {
  position: absolute;
  top: 0;
  left: -1px;
  width: 2px;
  background: hsl(130, 35%, 82%);
  pointer-events: none;
}

.sequencer-pitch {
  grid-row: 2;
  grid-column: 2;
}

.sequencer-overlay {
  grid-row: 2;
  grid-column: 2;
  position: relative;
  overflow: hidden;
  pointer-events: none;
}

.sequencer-phrase-indicator {
  position: absolute;
  top: -2px;
  left: 0;
  height: 6px;
  border-radius: 2px;
}

.sequencer-playhead {
  position: absolute;
  top: 0;
  left: -1px;
  width: 2px;
  height: 100%;
  background: rgba(colors.$display-rgb, 0.6);
  will-change: transform;
}

.rect-select-preview {
  pointer-events: none;
  position: absolute;
  border: 2px solid rgba(colors.$primary-rgb, 0.5);
  background: rgba(colors.$primary-rgb, 0.25);
}

.cursor-draw {
  cursor:
    url("/draw-cursor.png") 2 30,
    auto;
}

.zoom-x-slider {
  position: fixed;
  bottom: 16px;
  right: 32px;
  width: 80px;
}

.zoom-y-slider {
  position: fixed;
  bottom: 40px;
  right: 16px;
  height: 80px;
}
</style>
