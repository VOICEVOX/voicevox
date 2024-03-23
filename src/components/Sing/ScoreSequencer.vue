<template>
  <div class="score-sequencer">
    <!-- 左上の角 -->
    <div class="sequencer-corner"></div>
    <!-- ルーラー -->
    <SequencerRuler
      class="sequencer-ruler"
      :offset="scrollX"
      :num-of-measures="numOfMeasures"
    />
    <!-- 鍵盤 -->
    <SequencerKeys
      class="sequencer-keys"
      :offset="scrollY"
      :black-key-width="28"
    />
    <!-- シーケンサ -->
    <div
      ref="sequencerBody"
      class="sequencer-body"
      :class="{ 'rect-selecting': shiftKey }"
      aria-label="シーケンサ"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @dblclick="onDoubleClick"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
      @wheel="onWheel"
      @scroll="onScroll"
      @contextmenu.prevent
    >
      <!-- キャラクター全身 -->
      <CharacterPortrait />
      <!-- グリッド -->
      <!-- NOTE: 現状オクターブごとの罫線なし -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        :width="gridWidth"
        :height="gridHeight"
        class="sequencer-grid"
      >
        <defs>
          <pattern
            id="sequencer-grid-octave-cells"
            patternUnits="userSpaceOnUse"
            :width="gridCellWidth"
            :height="gridCellHeight * 12"
          >
            <rect
              v-for="(keyInfo, index) in keyInfos"
              :key="index"
              x="0"
              :y="gridCellHeight * index"
              :width="gridCellWidth"
              :height="gridCellHeight"
              :class="`sequencer-grid-cell sequencer-grid-cell-${keyInfo.color}`"
            />
            <template v-for="(keyInfo, index) in keyInfos" :key="index">
              <line
                v-if="keyInfo.pitch === 'C'"
                x1="0"
                :x2="gridCellWidth"
                :y1="gridCellHeight * (index + 1)"
                :y2="gridCellHeight * (index + 1)"
                stroke-width="1"
                class="sequencer-grid-octave-line"
              />
            </template>
          </pattern>
          <pattern
            id="sequencer-grid-measure"
            patternUnits="userSpaceOnUse"
            :width="beatWidth * beatsPerMeasure"
            :height="gridHeight"
          >
            <line
              v-for="n in beatsPerMeasure"
              :key="n"
              :x1="beatWidth * (n - 1)"
              :x2="beatWidth * (n - 1)"
              y1="0"
              y2="100%"
              stroke-width="1"
              :class="`sequencer-grid-${n === 1 ? 'measure' : 'beat'}-line`"
            />
          </pattern>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="url(#sequencer-grid-octave-cells)"
        />
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="url(#sequencer-grid-measure)"
        />
      </svg>
      <div
        v-if="showGuideLine"
        class="sequencer-guideline"
        :style="{
          height: `${gridHeight}px`,
          transform: `translateX(${guideLineX}px)`,
        }"
      ></div>
      <!-- TODO: 1つのv-forで全てのノートを描画できるようにする -->
      <SequencerNote
        v-for="note in unselectedNotes"
        :key="note.id"
        :note="note"
        :is-selected="false"
        @bar-mousedown="onNoteBarMouseDown($event, note)"
        @left-edge-mousedown="onNoteLeftEdgeMouseDown($event, note)"
        @right-edge-mousedown="onNoteRightEdgeMouseDown($event, note)"
        @lyric-mouse-down="onNoteLyricMouseDown($event, note)"
      />
      <SequencerNote
        v-for="note in nowPreviewing ? previewNotes : selectedNotes"
        :key="note.id"
        :note="note"
        :is-selected="true"
        @bar-mousedown="onNoteBarMouseDown($event, note)"
        @left-edge-mousedown="onNoteLeftEdgeMouseDown($event, note)"
        @right-edge-mousedown="onNoteRightEdgeMouseDown($event, note)"
        @lyric-mouse-down="onNoteLyricMouseDown($event, note)"
      />
    </div>
    <SequencerPitch
      v-if="showPitch"
      class="sequencer-pitch"
      :style="{
        marginRight: `${scrollBarWidth}px`,
        marginBottom: `${scrollBarWidth}px`,
      }"
      :is-activated="isActivated"
      :offset-x="scrollX"
      :offset-y="scrollY"
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
      />
      <SequencerPhraseIndicator
        v-for="phraseInfo in phraseInfos"
        :key="phraseInfo.key"
        :phrase-key="phraseInfo.key"
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
    <input
      type="range"
      :min="ZOOM_X_MIN"
      :max="ZOOM_X_MAX"
      :step="ZOOM_X_STEP"
      :value="zoomX"
      :style="{
        position: 'fixed',
        zIndex: 100,
        bottom: '20px',
        right: '36px',
        width: '80px',
      }"
      @input="setZoomX"
    />
    <input
      type="range"
      :min="ZOOM_Y_MIN"
      :max="ZOOM_Y_MAX"
      :step="ZOOM_Y_STEP"
      :value="zoomY"
      :style="{
        position: 'fixed',
        zIndex: 100,
        bottom: '68px',
        right: '-12px',
        transform: 'rotate(-90deg)',
        width: '80px',
      }"
      @input="setZoomY"
    />
    <ContextMenu ref="contextMenu" :menudata="contextMenuData" />
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
import { v4 as uuidv4 } from "uuid";
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu.vue";
import { isMac } from "@/type/preload";
import { useStore } from "@/store";
import { Note } from "@/store/type";
import {
  getMeasureDuration,
  getNoteDuration,
  getNumOfMeasures,
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
} from "@/sing/viewHelper";
import SequencerRuler from "@/components/Sing/SequencerRuler.vue";
import SequencerKeys from "@/components/Sing/SequencerKeys.vue";
import SequencerNote from "@/components/Sing/SequencerNote.vue";
import SequencerPhraseIndicator from "@/components/Sing/SequencerPhraseIndicator.vue";
import CharacterPortrait from "@/components/Sing/CharacterPortrait.vue";
import SequencerPitch from "@/components/Sing/SequencerPitch.vue";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";
import { useHotkeyManager } from "@/plugins/hotkeyPlugin";
import { useShiftKey } from "@/composables/useModifierKey";

type PreviewMode = "ADD" | "MOVE" | "RESIZE_RIGHT" | "RESIZE_LEFT";

defineProps<{ isActivated: boolean }>();

// 直接イベントが来ているかどうか
const isSelfEventTarget = (event: UIEvent) => {
  return event.target === event.currentTarget;
};

const store = useStore();
const state = store.state;

// 分解能（Ticks Per Quarter Note）
const tpqn = computed(() => state.tpqn);

// テンポ
const tempos = computed(() => state.tempos);

// 拍子
const timeSignatures = computed(() => state.timeSignatures);

// ノート
const notes = computed(() => store.getters.SELECTED_TRACK.notes);
const isNoteSelected = computed(() => {
  return state.selectedNoteIds.size > 0;
});
const unselectedNotes = computed(() => {
  const selectedNoteIds = state.selectedNoteIds;
  return notes.value.filter((value) => !selectedNoteIds.has(value.id));
});
const selectedNotes = computed(() => {
  const selectedNoteIds = state.selectedNoteIds;
  return notes.value.filter((value) => selectedNoteIds.has(value.id));
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

// シーケンサグリッド
const gridCellTicks = snapTicks; // ひとまずスナップ幅＝グリッドセル幅
const gridCellWidth = computed(() => {
  return tickToBaseX(gridCellTicks.value, tpqn.value) * zoomX.value;
});
const gridCellBaseHeight = getKeyBaseHeight();
const gridCellHeight = computed(() => {
  return gridCellBaseHeight * zoomY.value;
});
const numOfMeasures = computed(() => {
  // NOTE: 最低長: 仮32小節...スコア長(曲長さ)が決まっていないため、無限スクロール化する or 最後尾に足した場合は伸びるようにするなど？
  const minNumOfMeasures = 32;
  // NOTE: いったん最後尾に足した場合は伸びるようにする
  return Math.max(
    minNumOfMeasures,
    getNumOfMeasures(
      notes.value,
      tempos.value,
      timeSignatures.value,
      tpqn.value
    ) + 1
  );
});
const beatsPerMeasure = computed(() => {
  return timeSignatures.value[0].beats;
});
const beatWidth = computed(() => {
  const beatType = timeSignatures.value[0].beatType;
  const wholeNoteDuration = tpqn.value * 4;
  const beatTicks = wholeNoteDuration / beatType;
  return tickToBaseX(beatTicks, tpqn.value) * zoomX.value;
});
const gridWidth = computed(() => {
  // TODO: 複数拍子に対応する
  const beats = timeSignatures.value[0].beats;
  const beatType = timeSignatures.value[0].beatType;
  const measureDuration = getMeasureDuration(beats, beatType, tpqn.value);
  const numOfGridColumns =
    Math.round(measureDuration / gridCellTicks.value) * numOfMeasures.value;
  return gridCellWidth.value * numOfGridColumns;
});
const gridHeight = computed(() => {
  return gridCellHeight.value * keyInfos.length;
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
    const startBaseX = tickToBaseX(phrase.startTicks, tpqn.value);
    const endBaseX = tickToBaseX(phrase.endTicks, tpqn.value);
    const startX = startBaseX * zoomX.value;
    const endX = endBaseX * zoomX.value;
    return { key, x: startX, width: endX - startX };
  });
});
const showPitch = computed(() => {
  return state.experimentalSetting.showPitchInSongEditor;
});
const scrollBarWidth = ref(12);
const sequencerBody = ref<HTMLElement | null>(null);

// マウスカーソル位置
const cursorX = ref(0);
const cursorY = ref(0);

// プレビュー
// FIXME: 関連する値を１つのobjectにまとめる
const nowPreviewing = ref(false);
const previewNotes = ref<Note[]>([]);
const copiedNotesForPreview = new Map<string, Note>();
let previewMode: PreviewMode = "ADD";
let previewRequestId = 0;
let dragStartTicks = 0;
let dragStartNoteNumber = 0;
let dragStartGuideLineTicks = 0;
let draggingNoteId = ""; // FIXME: 無効状態はstring以外の型にする
let executePreviewProcess = false;
let edited = false; // プレビュー終了時にstore.stateの更新を行うかどうかを表す変数

// ダブルクリック
let mouseDownNoteId: string | undefined;
const clickedNoteIds: [string | undefined, string | undefined] = [
  undefined,
  undefined,
];
let ignoreDoubleClick = false;

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

  const editedNotes = new Map<string, Note>();
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

  const editedNotes = new Map<string, Note>();
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
    tpqn.value
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

  const editedNotes = new Map<string, Note>();
  for (const note of previewNotes.value) {
    const copiedNote = copiedNotesForPreview.get(note.id);
    if (!copiedNote) {
      throw new Error("copiedNote is undefined.");
    }
    const notePos = copiedNote.position;
    const noteEndPos = copiedNote.position + copiedNote.duration;
    const duration = Math.max(
      snapTicks.value,
      noteEndPos + movingTicks - notePos
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

  const editedNotes = new Map<string, Note>();
  for (const note of previewNotes.value) {
    const copiedNote = copiedNotesForPreview.get(note.id);
    if (!copiedNote) {
      throw new Error("copiedNote is undefined.");
    }
    const notePos = copiedNote.position;
    const noteEndPos = copiedNote.position + copiedNote.duration;
    const position = Math.min(
      noteEndPos - snapTicks.value,
      notePos + movingTicks
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

const preview = () => {
  if (executePreviewProcess) {
    if (previewMode === "ADD") {
      previewAdd();
    }
    if (previewMode === "MOVE") {
      previewMove();
    }
    if (previewMode === "RESIZE_RIGHT") {
      previewResizeRight();
    }
    if (previewMode === "RESIZE_LEFT") {
      previewResizeLeft();
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
    store.dispatch("LOG_WARN", "startPreview was called during preview.");
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
  const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
  const cursorNoteNumber = baseYToNoteNumber(cursorBaseY);
  // NOTE: 入力を補助する線の判定の境目はスナップ幅の3/4の位置
  const guideLineTicks =
    Math.round(cursorTicks / snapTicks.value - 0.25) * snapTicks.value;
  const copiedNotes: Note[] = [];
  if (mode === "ADD") {
    if (cursorNoteNumber < 0) {
      return;
    }
    note = {
      id: uuidv4(),
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
      const noteIdsToSelect: string[] = [];
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
  previewMode = mode;
  dragStartTicks = cursorTicks;
  dragStartNoteNumber = cursorNoteNumber;
  dragStartGuideLineTicks = guideLineTicks;
  draggingNoteId = note.id;
  executePreviewProcess = true;
  edited = mode === "ADD";
  copiedNotesForPreview.clear();
  for (const copiedNote of copiedNotes) {
    copiedNotesForPreview.set(copiedNote.id, copiedNote);
  }
  previewNotes.value = copiedNotes;
  nowPreviewing.value = true;
  previewRequestId = requestAnimationFrame(preview);
};

const onNoteBarMouseDown = (event: MouseEvent, note: Note) => {
  if (!isSelfEventTarget(event)) {
    return;
  }
  if (event.button === 0) {
    startPreview(event, "MOVE", note);
    mouseDownNoteId = note.id;
  } else if (!state.selectedNoteIds.has(note.id)) {
    selectOnlyThis(note);
  }
};

const onNoteLeftEdgeMouseDown = (event: MouseEvent, note: Note) => {
  if (!isSelfEventTarget(event)) {
    return;
  }
  if (event.button === 0) {
    startPreview(event, "RESIZE_LEFT", note);
    mouseDownNoteId = note.id;
  } else if (!state.selectedNoteIds.has(note.id)) {
    selectOnlyThis(note);
  }
};

const onNoteRightEdgeMouseDown = (event: MouseEvent, note: Note) => {
  if (!isSelfEventTarget(event)) {
    return;
  }
  if (event.button === 0) {
    startPreview(event, "RESIZE_RIGHT", note);
    mouseDownNoteId = note.id;
  } else if (!state.selectedNoteIds.has(note.id)) {
    selectOnlyThis(note);
  }
};

const onNoteLyricMouseDown = (event: MouseEvent, note: Note) => {
  if (!isSelfEventTarget(event)) {
    return;
  }
  if (!state.selectedNoteIds.has(note.id)) {
    selectOnlyThis(note);
  }
  if (event.button === 0) {
    mouseDownNoteId = note.id;
  }
};

const onMouseDown = (event: MouseEvent) => {
  if (!isSelfEventTarget(event)) {
    return;
  }

  // macOSの場合、Ctrl+クリックが右クリックのため、その場合はノートを追加しない
  if (isMac && event.ctrlKey && event.button === 0) {
    return;
  }

  // TODO: メニューが表示されている場合はメニュー非表示のみ行いたい

  // 選択中のノートが無い場合、プレビューを開始しノートIDをリセット
  if (event.button === 0) {
    if (event.shiftKey) {
      isRectSelecting.value = true;
      rectSelectStartX.value = cursorX.value;
      rectSelectStartY.value = cursorY.value;
    } else {
      startPreview(event, "ADD");
    }
    mouseDownNoteId = undefined;
  } else {
    store.dispatch("DESELECT_ALL_NOTES");
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
  if (event.button !== 0) {
    return;
  }
  clickedNoteIds[0] = clickedNoteIds[1];
  clickedNoteIds[1] = mouseDownNoteId;
  if (event.detail === 1) {
    ignoreDoubleClick = false;
  }
  if (nowPreviewing.value && edited) {
    ignoreDoubleClick = true;
  }

  if (isRectSelecting.value) {
    rectSelect(isOnCommandOrCtrlKeyDown(event));
    return;
  }

  if (!nowPreviewing.value) {
    return;
  }
  cancelAnimationFrame(previewRequestId);
  if (edited) {
    if (previewMode === "ADD") {
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
  nowPreviewing.value = false;
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
    tpqn.value
  );
  const endTicks = baseXToTick(
    (scrollX.value + left + width) / zoomX.value,
    tpqn.value
  );
  const endNoteNumber = baseYToNoteNumber((scrollY.value + top) / zoomY.value);
  const startNoteNumber = baseYToNoteNumber(
    (scrollY.value + top + height) / zoomY.value
  );

  const noteIdsToSelect: string[] = [];
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

const onDoubleClick = () => {
  if (
    ignoreDoubleClick ||
    clickedNoteIds[0] !== clickedNoteIds[1] ||
    clickedNoteIds[1] == undefined
  ) {
    return;
  }

  const noteId = clickedNoteIds[1];
  if (state.editingLyricNoteId !== noteId) {
    store.dispatch("SET_EDITING_LYRIC_NOTE_ID", { noteId });
  }
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
const setZoomX = (event: Event) => {
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  if (event.target instanceof HTMLInputElement) {
    // 画面の中央を基準に水平方向のズームを行う
    const oldZoomX = zoomX.value;
    const newZoomX = Number(event.target.value);
    const scrollLeft = sequencerBodyElement.scrollLeft;
    const scrollTop = sequencerBodyElement.scrollTop;
    const clientWidth = sequencerBodyElement.clientWidth;

    store.dispatch("SET_ZOOM_X", { zoomX: newZoomX }).then(() => {
      const centerBaseX = (scrollLeft + clientWidth / 2) / oldZoomX;
      const newScrollLeft = centerBaseX * newZoomX - clientWidth / 2;
      sequencerBodyElement.scrollTo(newScrollLeft, scrollTop);
    });
  }
};

// Y軸ズーム
const setZoomY = (event: Event) => {
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  if (event.target instanceof HTMLInputElement) {
    // 画面の中央を基準に垂直方向のズームを行う
    const oldZoomY = zoomY.value;
    const newZoomY = Number(event.target.value);
    const scrollLeft = sequencerBodyElement.scrollLeft;
    const scrollTop = sequencerBodyElement.scrollTop;
    const clientHeight = sequencerBodyElement.clientHeight;

    store.dispatch("SET_ZOOM_Y", { zoomY: newZoomY }).then(() => {
      const centerBaseY = (scrollTop + clientHeight / 2) / oldZoomY;
      const newScrollTop = centerBaseY * newZoomY - clientHeight / 2;
      sequencerBodyElement.scrollTo(scrollLeft, newScrollTop);
    });
  }
};

const onWheel = (event: WheelEvent) => {
  const sequencerBodyElement = sequencerBody.value;
  if (!sequencerBodyElement) {
    throw new Error("sequencerBodyElement is null.");
  }
  if (isOnCommandOrCtrlKeyDown(event)) {
    cursorX.value = getXInBorderBox(event.clientX, sequencerBodyElement);
    // マウスカーソル位置を基準に水平方向のズームを行う
    const oldZoomX = zoomX.value;
    let newZoomX = zoomX.value;
    newZoomX -= event.deltaY * (ZOOM_X_STEP * 0.01);
    newZoomX = Math.min(ZOOM_X_MAX, newZoomX);
    newZoomX = Math.max(ZOOM_X_MIN, newZoomX);
    const scrollLeft = sequencerBodyElement.scrollLeft;
    const scrollTop = sequencerBodyElement.scrollTop;

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
  nextTick().then(() => {
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

const contextMenuData = ref<ContextMenuItemData[]>([
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
]);
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

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

.sequencer-grid {
  display: block;
  pointer-events: none;
}

.sequencer-grid-cell {
  display: block;
  stroke: rgba(colors.$sequencer-sub-divider-rgb, 0.3);
  stroke-width: 1;
}

.sequencer-grid-octave-cell {
  stroke: colors.$sequencer-main-divider;
}

.sequencer-grid-octave-line {
  backface-visibility: hidden;
  stroke: colors.$sequencer-main-divider;
}

.sequencer-grid-cell-white {
  fill: colors.$sequencer-whitekey-cell;
}

.sequencer-grid-cell-black {
  fill: colors.$sequencer-blackkey-cell;
}

.sequencer-grid-measure-line {
  backface-visibility: hidden;
  stroke: colors.$sequencer-main-divider;
}

.sequencer-grid-beat-line {
  backface-visibility: hidden;
  stroke: colors.$sequencer-sub-divider;
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
  left: -2px;
  width: 4px;
  height: 100%;
  background: colors.$primary;
  border-left: 1px solid rgba(colors.$background-rgb, 0.83);
  border-right: 1px solid rgba(colors.$background-rgb, 0.83);
}

.rect-select-preview {
  pointer-events: none;
  position: absolute;
  border: 2px solid rgba(colors.$primary-rgb, 0.5);
  background: rgba(colors.$primary-rgb, 0.25);
}
</style>
