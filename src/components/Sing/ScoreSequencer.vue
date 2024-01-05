<template>
  <div class="score-sequencer">
    <!-- 左上の角 -->
    <div class="sequencer-corner"></div>
    <!-- ルーラー -->
    <sequencer-ruler
      class="sequencer-ruler"
      :offset="scrollX"
      :num-of-measures="numOfMeasures"
    />
    <!-- 鍵盤 -->
    <sequencer-keys
      class="sequencer-keys"
      :offset="scrollY"
      :black-key-width="28"
    />
    <!-- シーケンサ -->
    <div
      ref="sequencerBody"
      class="sequencer-body"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @dblclick="onDoubleClick"
      @wheel="onWheel"
      @scroll="onScroll"
    >
      <!-- グリッド -->
      <!-- NOTE: 現状オクターブごとの罫線なし -->
      <svg
        :width="gridWidth"
        :height="gridHeight"
        xmlns="http://www.w3.org/2000/svg"
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
            <line
              :x1="beatWidth * beatsPerMeasure"
              :x2="beatWidth * beatsPerMeasure"
              y1="0"
              y2="100%"
              stroke-width="1"
              class="sequencer-grid-measure-line"
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
      <sequencer-note
        v-for="note in unselectedNotes"
        :key="note.id"
        :note="note"
        @body-mousedown="onNoteBodyMouseDown($event, note)"
        @left-edge-mousedown="onNoteLeftEdgeMouseDown($event, note)"
        @right-edge-mousedown="onNoteRightEdgeMouseDown($event, note)"
        @lyric-mouse-down="onNoteLyricMouseDown(note)"
      />
      <sequencer-note
        v-for="note in nowPreviewing ? previewNotes : selectedNotes"
        :key="note.id"
        :note="note"
        is-selected
        @body-mousedown="onNoteBodyMouseDown($event, note)"
        @left-edge-mousedown="onNoteLeftEdgeMouseDown($event, note)"
        @right-edge-mousedown="onNoteRightEdgeMouseDown($event, note)"
        @lyric-mouse-down="onNoteLyricMouseDown(note)"
      />
    </div>
    <div
      class="sequencer-overlay"
      :style="{
        marginRight: `${scrollBarWidth}px`,
        marginBottom: `${scrollBarWidth}px`,
      }"
    >
      <sequencer-phrase-indicator
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
        :style="{
          transform: `translateX(${playheadX - scrollX}px)`,
        }"
      ></div>
    </div>
    <!-- NOTE: スクロールバー+ズームレンジ仮 -->
    <input
      type="range"
      :min="ZOOM_X_MIN"
      :max="ZOOM_X_MAX"
      :step="ZOOM_X_STEP"
      :value="zoomX"
      :style="{
        position: 'fixed',
        zIndex: 10000,
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
        zIndex: 10000,
        bottom: '68px',
        right: '-12px',
        transform: 'rotate(-90deg)',
        width: '80px',
      }"
      @input="setZoomY"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref, onMounted, onUnmounted } from "vue";
import { v4 as uuidv4 } from "uuid";
import { useStore } from "@/store";
import SequencerRuler from "@/components/Sing/SequencerRuler.vue";
import SequencerKeys from "@/components/Sing/SequencerKeys.vue";
import SequencerNote from "@/components/Sing/SequencerNote.vue";
import SequencerPhraseIndicator from "@/components/Sing/SequencerPhraseIndicator.vue";
import {
  getMeasureDuration,
  getNoteDuration,
  getKeyBaseHeight,
  tickToBaseX,
  baseXToTick,
  noteNumberToBaseY,
  baseYToNoteNumber,
  keyInfos,
  getDoremiFromNoteNumber,
  getNumOfMeasures,
  ZOOM_X_MIN,
  ZOOM_X_MAX,
  ZOOM_X_STEP,
  ZOOM_Y_MIN,
  ZOOM_Y_MAX,
  ZOOM_Y_STEP,
  PREVIEW_SOUND_DURATION,
} from "@/helpers/singHelper";
import { Note } from "@/store/type";

type PreviewMode = "ADD" | "MOVE" | "RESIZE_RIGHT" | "RESIZE_LEFT";

type ClickedNoteInfo = {
  id: string;
  edited: boolean;
};

export default defineComponent({
  name: "SingScoreSequencer",
  components: {
    SequencerRuler,
    SequencerKeys,
    SequencerNote,
    SequencerPhraseIndicator,
  },
  setup() {
    const store = useStore();
    const state = store.state;
    // 分解能（Ticks Per Quarter Note）
    const tpqn = computed(() => state.score.tpqn);
    // ノート
    const notes = computed(() => state.score.notes);
    // テンポ
    const tempos = computed(() => state.score.tempos);
    // 拍子
    const timeSignatures = computed(() => state.score.timeSignatures);
    // ズーム状態
    const zoomX = computed(() => state.sequencerZoomX);
    const zoomY = computed(() => state.sequencerZoomY);
    // スナップ
    const snapTicks = computed(() => {
      return getNoteDuration(state.sequencerSnapType, tpqn.value);
    });
    // シーケンサグリッド
    const gridCellTicks = snapTicks; // ひとまずスナップ幅＝グリッドセル幅
    const gridCellBaseWidth = computed(() => {
      return tickToBaseX(gridCellTicks.value, tpqn.value);
    });
    const gridCellWidth = computed(() => {
      return gridCellBaseWidth.value * zoomX.value;
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
    const unselectedNotes = computed(() => {
      const selectedNoteIds = state.selectedNoteIds;
      return notes.value.filter((value) => !selectedNoteIds.has(value.id));
    });
    const selectedNotes = computed(() => {
      const selectedNoteIds = state.selectedNoteIds;
      return notes.value.filter((value) => selectedNoteIds.has(value.id));
    });
    const phraseInfos = computed(() => {
      return Object.entries(state.phrases).map(([key, phrase]) => {
        const startBaseX = tickToBaseX(phrase.startTicks, tpqn.value);
        const endBaseX = tickToBaseX(phrase.endTicks, tpqn.value);
        const startX = startBaseX * zoomX.value;
        const endX = endBaseX * zoomX.value;
        return { key, x: startX, width: endX - startX };
      });
    });
    const scrollBarWidth = ref(12);
    const sequencerBody = ref<HTMLElement | null>(null);

    // プレビュー
    // FIXME: 関連する値を１つのobjectにまとめる
    const nowPreviewing = ref(false);
    const previewNotes = ref<Note[]>([]);
    const copiedNotesForPreview = new Map<string, Note>();
    let previewMode: PreviewMode = "ADD";
    let previewRequestId = 0;
    let currentCursorX = 0;
    let currentCursorY = 0;
    let dragStartTicks = 0;
    let dragStartNoteNumber = 0;
    let draggingNoteId = ""; // FIXME: 無効状態はstring以外の型にする
    let edited = false;
    // ダブルクリック
    let mouseDownNoteId: string | undefined;
    let clickedNoteInfos: (ClickedNoteInfo | undefined)[] = [];

    const previewAdd = () => {
      const cursorBaseX = (scrollX.value + currentCursorX) / zoomX.value;
      const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
      const draggingNote = copiedNotesForPreview.get(draggingNoteId);
      if (!draggingNote) {
        throw new Error("draggingNote is undefined.");
      }
      const noteEndPos = draggingNote.position + draggingNote.duration;
      const newNoteEndPos =
        Math.round(cursorTicks / snapTicks.value) * snapTicks.value;
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
      }
    };

    const previewMove = () => {
      const cursorBaseX = (scrollX.value + currentCursorX) / zoomX.value;
      const cursorBaseY = (scrollY.value + currentCursorY) / zoomY.value;
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
    };

    const previewResizeRight = () => {
      const cursorBaseX = (scrollX.value + currentCursorX) / zoomX.value;
      const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
      const draggingNote = copiedNotesForPreview.get(draggingNoteId);
      if (!draggingNote) {
        throw new Error("draggingNote is undefined.");
      }
      const dragTicks = cursorTicks - dragStartTicks;
      const noteEndPos = draggingNote.position + draggingNote.duration;
      const newNoteEndPos =
        Math.round((noteEndPos + dragTicks) / snapTicks.value) *
        snapTicks.value;
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
    };

    const previewResizeLeft = () => {
      const cursorBaseX = (scrollX.value + currentCursorX) / zoomX.value;
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
    };

    const preview = () => {
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
      previewRequestId = requestAnimationFrame(preview);
    };

    const getXInBorderBox = (clientX: number, element: HTMLElement) => {
      return clientX - element.getBoundingClientRect().left;
    };

    const getYInBorderBox = (clientY: number, element: HTMLElement) => {
      return clientY - element.getBoundingClientRect().top;
    };

    const startPreview = (
      event: MouseEvent,
      mode: PreviewMode,
      note?: Note
    ) => {
      if (nowPreviewing.value) {
        // RESIZE_RIGHT・RESIZE_LEFTのあとにADDも発生するので、その場合は無視する
        // TODO: stopPropagation付けたり、他のイベントではエラーを投げるようにする
        return;
      }
      const sequencerBodyElement = sequencerBody.value;
      if (!sequencerBodyElement) {
        throw new Error("sequencerBodyElement is null.");
      }
      const cursorX = getXInBorderBox(event.clientX, sequencerBodyElement);
      const cursorY = getYInBorderBox(event.clientY, sequencerBodyElement);
      if (cursorX >= sequencerBodyElement.clientWidth) {
        return;
      }
      if (cursorY >= sequencerBodyElement.clientHeight) {
        return;
      }
      const cursorBaseX = (scrollX.value + cursorX) / zoomX.value;
      const cursorBaseY = (scrollY.value + cursorY) / zoomY.value;
      const cursorTicks = baseXToTick(cursorBaseX, tpqn.value);
      const cursorNoteNumber = baseYToNoteNumber(cursorBaseY);
      const copiedNotes: Note[] = [];
      if (mode === "ADD") {
        if (cursorNoteNumber < 0) {
          return;
        }
        note = {
          id: uuidv4(),
          position: Math.round(cursorTicks / snapTicks.value) * snapTicks.value,
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
        if (state.selectedNoteIds.has(note.id)) {
          for (const note of selectedNotes.value) {
            copiedNotes.push({ ...note });
          }
        } else {
          store.dispatch("DESELECT_ALL_NOTES");
          store.dispatch("SELECT_NOTES", { noteIds: [note.id] });
          store.dispatch("PLAY_PREVIEW_SOUND", {
            noteNumber: note.noteNumber,
            duration: PREVIEW_SOUND_DURATION,
          });
          copiedNotes.push({ ...note });
        }
      }
      previewMode = mode;
      currentCursorX = cursorX;
      currentCursorY = cursorY;
      dragStartTicks = cursorTicks;
      dragStartNoteNumber = cursorNoteNumber;
      draggingNoteId = note.id;
      edited = mode === "ADD";
      copiedNotesForPreview.clear();
      for (const copiedNote of copiedNotes) {
        copiedNotesForPreview.set(copiedNote.id, copiedNote);
      }
      previewNotes.value = copiedNotes;
      nowPreviewing.value = true;
      previewRequestId = requestAnimationFrame(preview);
    };

    const onNoteBodyMouseDown = (event: MouseEvent, note: Note) => {
      startPreview(event, "MOVE", note);
      mouseDownNoteId = note.id;
    };

    const onNoteLeftEdgeMouseDown = (event: MouseEvent, note: Note) => {
      startPreview(event, "RESIZE_LEFT", note);
      mouseDownNoteId = note.id;
    };

    const onNoteRightEdgeMouseDown = (event: MouseEvent, note: Note) => {
      startPreview(event, "RESIZE_RIGHT", note);
      mouseDownNoteId = note.id;
    };

    const onNoteLyricMouseDown = (note: Note) => {
      if (!state.selectedNoteIds.has(note.id)) {
        store.dispatch("DESELECT_ALL_NOTES");
        store.dispatch("SELECT_NOTES", { noteIds: [note.id] });
        store.dispatch("PLAY_PREVIEW_SOUND", {
          noteNumber: note.noteNumber,
          duration: PREVIEW_SOUND_DURATION,
        });
      }
      mouseDownNoteId = note.id;
    };

    const onMouseDown = (event: MouseEvent) => {
      startPreview(event, "ADD");
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!nowPreviewing.value) {
        return;
      }
      const sequencerBodyElement = sequencerBody.value;
      if (!sequencerBodyElement) {
        throw new Error("sequencerBodyElement is null.");
      }
      currentCursorX = getXInBorderBox(event.clientX, sequencerBodyElement);
      currentCursorY = getYInBorderBox(event.clientY, sequencerBodyElement);
    };

    const onMouseUp = (event: MouseEvent) => {
      if (event.detail === 1) {
        clickedNoteInfos = [];
      }
      if (mouseDownNoteId == undefined) {
        clickedNoteInfos.push(undefined);
      } else {
        clickedNoteInfos.push({
          id: mouseDownNoteId,
          edited: nowPreviewing.value && edited,
        });
        mouseDownNoteId = undefined;
      }

      if (!nowPreviewing.value) {
        return;
      }
      cancelAnimationFrame(previewRequestId);
      if (edited) {
        if (previewMode === "ADD") {
          store.dispatch("ADD_NOTES", { notes: previewNotes.value });
          store.dispatch("SELECT_NOTES", {
            noteIds: previewNotes.value.map((value) => value.id),
          });
        } else {
          store.dispatch("UPDATE_NOTES", { notes: previewNotes.value });
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

    const onDoubleClick = () => {
      if (clickedNoteInfos.length < 2) {
        return;
      }
      if (clickedNoteInfos.some((value) => value?.edited ?? false)) {
        return;
      }
      if (clickedNoteInfos[0] == undefined) {
        return;
      }
      for (let i = 1; i < clickedNoteInfos.length; i++) {
        if (clickedNoteInfos[i - 1]?.id !== clickedNoteInfos[i]?.id) {
          return;
        }
      }

      const noteId = clickedNoteInfos[0].id;
      if (state.editingLyricNoteId !== noteId) {
        store.dispatch("SET_EDITING_LYRIC_NOTE_ID", { noteId });
      }
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
      store.dispatch("UPDATE_NOTES", { notes: editedNotes });

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
      store.dispatch("UPDATE_NOTES", { notes: editedNotes });

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
      store.dispatch("UPDATE_NOTES", { notes: editedNotes });
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
      store.dispatch("UPDATE_NOTES", { notes: editedNotes });
    };

    const handleNotesBackspaceOrDelete = () => {
      if (state.selectedNoteIds.size === 0) {
        // TODO: 例外処理は`REMOVE_SELECTED_NOTES`内に移す？
        return;
      }
      store.dispatch("REMOVE_SELECTED_NOTES");
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
        default:
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
      if (event.ctrlKey) {
        // マウスカーソル位置を基準に水平方向のズームを行う
        const cursorX = getXInBorderBox(event.clientX, sequencerBodyElement);
        const oldZoomX = zoomX.value;
        let newZoomX = zoomX.value;
        newZoomX -= event.deltaY * (ZOOM_X_STEP * 0.01);
        newZoomX = Math.min(ZOOM_X_MAX, newZoomX);
        newZoomX = Math.max(ZOOM_X_MIN, newZoomX);
        const scrollLeft = sequencerBodyElement.scrollLeft;
        const scrollTop = sequencerBodyElement.scrollTop;

        store.dispatch("SET_ZOOM_X", { zoomX: newZoomX }).then(() => {
          const cursorBaseX = (scrollLeft + cursorX) / oldZoomX;
          const newScrollLeft = cursorBaseX * newZoomX - cursorX;
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

    onMounted(() => {
      const sequencerBodyElement = sequencerBody.value;
      if (!sequencerBodyElement) {
        throw new Error("sequencerBodyElement is null.");
      }
      // 上から2/3の位置がC4になるようにスクロールする
      const clientHeight = sequencerBodyElement.clientHeight;
      const c4BaseY = noteNumberToBaseY(60);
      const clientBaseHeight = clientHeight / zoomY.value;
      const scrollBaseY = c4BaseY - clientBaseHeight * (2 / 3);
      sequencerBodyElement.scrollTo(0, scrollBaseY * zoomY.value);

      // スクロールバーの幅を取得する
      const clientWidth = sequencerBodyElement.clientWidth;
      const offsetWidth = sequencerBodyElement.offsetWidth;
      scrollBarWidth.value = offsetWidth - clientWidth;

      store.dispatch("ADD_PLAYHEAD_POSITION_CHANGE_LISTENER", {
        listener: playheadPositionChangeListener,
      });

      document.addEventListener("keydown", handleKeydown);
    });

    onUnmounted(() => {
      store.dispatch("REMOVE_PLAYHEAD_POSITION_CHANGE_LISTENER", {
        listener: playheadPositionChangeListener,
      });

      document.removeEventListener("keydown", handleKeydown);
    });

    return {
      ZOOM_X_MIN,
      ZOOM_X_MAX,
      ZOOM_X_STEP,
      ZOOM_Y_MIN,
      ZOOM_Y_MAX,
      ZOOM_Y_STEP,
      beatsPerMeasure,
      beatWidth,
      gridCellWidth,
      gridCellHeight,
      numOfMeasures,
      gridWidth,
      gridHeight,
      keyInfos,
      notes,
      zoomX,
      zoomY,
      scrollX,
      scrollY,
      playheadX,
      phraseInfos,
      scrollBarWidth,
      sequencerBody,
      nowPreviewing,
      previewNotes,
      selectedNotes,
      unselectedNotes,
      setZoomX,
      setZoomY,
      onNoteBodyMouseDown,
      onNoteLeftEdgeMouseDown,
      onNoteRightEdgeMouseDown,
      onNoteLyricMouseDown,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onDoubleClick,
      onWheel,
      onScroll,
    };
  },
});
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
  background: #fff;
  border-bottom: 1px solid #ccc;
  border-right: 1px solid #ccc;
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

.sequencer-grid {
  display: block;
}

.sequencer-grid-cell {
  display: block;
  stroke: #e8e8e8;
  stroke-width: 1;
}

.sequencer-grid-cell-white {
  fill: #fff;
}

.sequencer-grid-cell-black {
  fill: #f2f2f2;
}

.sequencer-grid-measure-line {
  backface-visibility: hidden;
  stroke: #b0b0b0;
}

.sequencer-grid-beat-line {
  backface-visibility: hidden;
  stroke: #d0d0d0;
}
</style>
