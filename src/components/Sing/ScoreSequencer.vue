<template>
  <div
    class="score-sequencer"
    :style="{
      display: 'grid',
      gridTemplateRows: `${rulerHeight}px 1fr`,
      gridTemplateColumns: `${keysWidth}px 1fr`,
    }"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @dblclick="addNote"
  >
    <!-- 左上の角 -->
    <div class="corner"></div>
    <!-- ルーラー -->
    <sequencer-ruler
      :offset="scrollX"
      :height="rulerHeight"
      :num-of-measures="numOfMeasures"
    />
    <!-- 鍵盤 -->
    <sequencer-keys
      :offset="scrollY"
      :width="keysWidth"
      :black-key-width="30"
    />
    <!-- シーケンサ -->
    <div id="sequencer-body" class="sequencer-body" @scroll="onScroll">
      <!-- グリッド -->
      <!-- NOTE: 現状小節+オクターブごとの罫線なし -->
      <svg
        :width="gridCellWidth * numOfGridColumns"
        :height="gridCellHeight * keyInfos.length"
        xmlns="http://www.w3.org/2000/svg"
        class="sequencer-grid"
      >
        <!-- パターングリッド -->
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
            :height="gridCellHeight * keyInfos.length"
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
        v-for="(note, index) in notes"
        :key="index"
        :note="note"
        :index="index"
        :cursor-x="cursorX"
        :cursor-y="cursorY"
        @handleNotesKeydown="handleNotesKeydown"
        @handleDragMoveStart="handleDragMoveStart"
        @handleDragRightStart="handleDragRightStart"
        @handleDragLeftStart="handleDragLeftStart"
      />
    </div>
    <!-- NOTE: スクロールバー+ズームレンジ仮 -->
    <input
      type="range"
      min="0.2"
      max="1"
      step="0.05"
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
      min="0.25"
      max="1"
      step="0.05"
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
import { defineComponent, computed, ref, onMounted } from "vue";
import { v4 as uuidv4 } from "uuid";
import { useStore } from "@/store";
import SequencerRuler from "@/components/Sing/SequencerRuler.vue";
import SequencerKeys from "@/components/Sing/SequencerKeys.vue";
import SequencerNote from "@/components/Sing/SequencerNote.vue";
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
} from "@/helpers/singHelper";

export default defineComponent({
  name: "SingScoreSequencer",
  components: {
    SequencerRuler,
    SequencerKeys,
    SequencerNote,
  },
  props: {
    rulerHeight: { type: Number, default: 32 },
    keysWidth: { type: Number, default: 48 },
  },
  setup() {
    enum DragMode {
      NONE = "NONE",
      MOVE = "MOVE",
      NOTE_RIGHT = "NOTE_RIGHT",
      NOTE_LEFT = "NOTE_LEFT",
      SELECT = "SELECT",
    }
    const store = useStore();
    const state = store.state;
    // カーソルポジション
    const cursorX = ref(0);
    const cursorY = ref(0);
    // ドラッグ状態
    const dragMode = ref<DragMode>(DragMode.NONE);
    const dragId = ref(0);
    const dragMoveCurrentX = ref();
    const dragMoveCurrentY = ref();
    const dragDurationCurrentX = ref();
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
    const snapBaseWidth = computed(() => {
      return tickToBaseX(snapTicks.value, tpqn.value);
    });
    const snapWidth = computed(() => {
      return snapBaseWidth.value * zoomX.value;
    });
    // シーケンサグリッド
    const gridCellTicks = snapTicks; // ひとまずスナップ幅＝グリッドセル幅
    const gridCellBaseWidth = snapBaseWidth;
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
    const numOfGridColumns = computed(() => {
      // TODO: 複数拍子に対応する
      const beats = timeSignatures.value[0].beats;
      const beatType = timeSignatures.value[0].beatType;
      const measureDuration = getMeasureDuration(beats, beatType, tpqn.value);
      const numOfGridColumnsPerMeasure = Math.round(
        measureDuration / gridCellTicks.value
      );
      return numOfGridColumnsPerMeasure * numOfMeasures.value;
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
    // スクロール位置
    const scrollX = ref(0);
    const scrollY = ref(0);
    const selectedNoteIds = computed(() => state.selectedNoteIds);

    // ノートの追加
    const addNote = (event: MouseEvent) => {
      const eventOffsetBaseX = event.offsetX / zoomX.value;
      const eventOffsetBaseY = event.offsetY / zoomY.value;
      const positionBaseX =
        gridCellBaseWidth.value *
        Math.floor(eventOffsetBaseX / gridCellBaseWidth.value);
      const position = baseXToTick(positionBaseX, tpqn.value);
      const noteNumber = baseYToNoteNumber(eventOffsetBaseY);
      if (noteNumber < 0) {
        return;
      }
      // NOTE: ノートの長さはスナップをベース（最小の長さは1/8）
      const noteType = Math.min(8, state.sequencerSnapType);
      const duration = getNoteDuration(noteType, tpqn.value);
      const lyric = getDoremiFromNoteNumber(noteNumber);
      // NOTE: 仮ID
      const id = uuidv4();
      store.dispatch("ADD_NOTE", {
        note: {
          id,
          position,
          noteNumber,
          duration,
          lyric,
        },
      });
    };

    // マウスダウン
    // 選択中のノートがある場合は選択リセット
    const handleMouseDown = () => {
      if (0 < selectedNoteIds.value.length) {
        store.dispatch("CLEAR_SELECTED_NOTE_IDS");
      }
    };

    // マウス移動
    // ドラッグ中の場合はカーソル位置を保持
    const handleMouseMove = (event: MouseEvent) => {
      if (dragMode.value !== DragMode.NONE) {
        cursorX.value = event.clientX;
        cursorY.value = event.clientY;
      }
    };

    // マウスアップ
    // ドラッグしていた場合はドラッグを終了
    const handleMouseUp = () => {
      if (dragMode.value !== DragMode.NONE) {
        cancelAnimationFrame(dragId.value);
        dragMode.value = DragMode.NONE;
        return;
      }
    };

    // ドラッグでのノートの移動
    const dragMove = () => {
      if (dragMode.value !== DragMode.MOVE) {
        cancelAnimationFrame(dragId.value);
        return;
      }
      // X方向, Y方向の移動距離
      const distanceX = cursorX.value - dragMoveCurrentX.value;
      const distanceY = cursorY.value - dragMoveCurrentY.value;

      // カーソル位置に応じてノート移動量を計算
      let amountPositionX = 0;
      if (gridCellWidth.value <= Math.abs(distanceX)) {
        amountPositionX = 0 < distanceX ? snapTicks.value : -snapTicks.value;
        const dragMoveCurrentXNext =
          dragMoveCurrentX.value +
          (0 < amountPositionX ? gridCellWidth.value : -gridCellWidth.value);
        dragMoveCurrentX.value = dragMoveCurrentXNext;
      }
      let amountPositionY = 0;
      if (gridCellHeight.value <= Math.abs(distanceY)) {
        amountPositionY = 0 < distanceY ? -1 : 1;
        const dragMoveCurrentYNext =
          dragMoveCurrentY.value +
          (0 > amountPositionY ? gridCellHeight.value : -gridCellHeight.value);
        dragMoveCurrentY.value = dragMoveCurrentYNext;
      }

      // 選択中のノートのpositionとnoteNumberを変更
      let isNotesChanged = false;
      const newNotes = state.score.notes.map((note) => {
        if (selectedNoteIds.value.includes(note.id)) {
          if (amountPositionX === 0 && amountPositionY === 0) {
            return note;
          }
          isNotesChanged = true;
          const position = note.position + amountPositionX;
          const noteNumber = note.noteNumber + amountPositionY;
          return {
            ...note,
            noteNumber,
            position,
          };
        } else {
          return note;
        }
      });

      // 左端より前はドラッグしない
      if (newNotes.some((note) => note.position < 0)) {
        dragId.value = requestAnimationFrame(dragMove);
        return;
      }
      if (isNotesChanged) {
        store.dispatch("REPLACE_ALL_NOTES", { notes: newNotes });
      }
      dragId.value = requestAnimationFrame(dragMove);
    };

    // ノートドラッグ開始
    const handleDragMoveStart = (event: MouseEvent) => {
      if (selectedNoteIds.value.length > 0) {
        dragMode.value = DragMode.MOVE;
        setTimeout(() => {
          dragMoveCurrentX.value = event.clientX;
          dragMoveCurrentY.value = event.clientY;
          dragId.value = requestAnimationFrame(dragMove);
        }, 360);
      }
    };

    // ノート右ドラッグ
    // FIXME: 左右ドラッグロジックを統一する
    const dragRight = () => {
      if (dragMode.value !== DragMode.NOTE_RIGHT) {
        cancelAnimationFrame(dragId.value);
        return;
      }
      const distanceX = cursorX.value - dragDurationCurrentX.value;
      if (snapWidth.value <= Math.abs(distanceX)) {
        let isNotesChanged = false;
        const newNotes = state.score.notes.map((note) => {
          if (selectedNoteIds.value.includes(note.id)) {
            const duration =
              note.duration +
              (0 < distanceX ? snapTicks.value : -snapTicks.value);
            if (duration < Math.max(snapTicks.value, 0) || note.position < 0) {
              return note;
            } else {
              isNotesChanged = true;
              return {
                ...note,
                duration,
              };
            }
          } else {
            return note;
          }
        });
        const dragDurationCurrentXNext =
          dragDurationCurrentX.value +
          (0 < distanceX ? snapWidth.value : -snapWidth.value);
        dragDurationCurrentX.value = dragDurationCurrentXNext;
        dragId.value = requestAnimationFrame(dragRight);
        if (isNotesChanged) {
          store.dispatch("REPLACE_ALL_NOTES", { notes: newNotes });
        }
      }
      dragId.value = requestAnimationFrame(dragRight);
    };

    // ノート右ドラッグ開始
    const handleDragRightStart = (event: MouseEvent) => {
      dragMode.value = DragMode.NOTE_RIGHT;
      setTimeout(() => {
        dragDurationCurrentX.value = event.clientX;
        dragId.value = requestAnimationFrame(dragRight);
      }, 360);
    };

    // ノート左ドラッグ
    // FIXME: 左右ドラッグロジックを統一する
    const dragLeft = () => {
      if (dragMode.value !== DragMode.NOTE_LEFT) {
        cancelAnimationFrame(dragId.value);
        return;
      }
      const distanceX = cursorX.value - dragDurationCurrentX.value;
      if (snapWidth.value <= Math.abs(distanceX)) {
        let isNotesChanged = false;
        const newNotes = state.score.notes.map((note) => {
          if (selectedNoteIds.value.includes(note.id)) {
            const position =
              note.position +
              (0 < distanceX ? snapTicks.value : -snapTicks.value);
            const duration =
              note.duration +
              (0 > distanceX ? snapTicks.value : -snapTicks.value);
            if (duration < Math.max(snapTicks.value, 0) || note.position < 0) {
              return note;
            } else {
              isNotesChanged = true;
              return {
                ...note,
                position,
                duration,
              };
            }
          } else {
            return note;
          }
        });
        const dragDurationCurrentXNext =
          dragDurationCurrentX.value +
          (0 < distanceX ? snapWidth.value : -snapWidth.value);
        dragDurationCurrentX.value = dragDurationCurrentXNext;
        dragId.value = requestAnimationFrame(dragLeft);
        if (isNotesChanged) {
          store.dispatch("REPLACE_ALL_NOTES", { notes: newNotes });
        }
      }
      dragId.value = requestAnimationFrame(dragLeft);
    };

    // ノート左ドラッグ開始
    const handleDragLeftStart = (event: MouseEvent) => {
      dragMode.value = DragMode.NOTE_LEFT;
      setTimeout(() => {
        dragDurationCurrentX.value = event.clientX;
        dragId.value = requestAnimationFrame(dragLeft);
      }, 360);
    };

    // X軸ズーム
    const setZoomX = (event: Event) => {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }
      store.dispatch("SET_ZOOM_X", {
        zoomX: Number(event.target.value),
      });
    };

    // Y軸ズーム
    const setZoomY = (event: Event) => {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }
      store.dispatch("SET_ZOOM_Y", {
        zoomY: Number(event.target.value),
      });
    };

    // キーボードイベント
    const handleNotesArrowUp = () => {
      const newNotes = state.score.notes.map((note) => {
        if (selectedNoteIds.value.includes(note.id)) {
          const noteNumber = Math.min(note.noteNumber + 1, 127);
          return {
            ...note,
            noteNumber,
          };
        } else {
          return note;
        }
      });
      if (newNotes.some((note) => note.noteNumber > 127)) {
        return;
      }
      store.dispatch("REPLACE_ALL_NOTES", { notes: newNotes });
    };

    const handleNotesArrowDown = () => {
      const newNotes = state.score.notes.map((note) => {
        if (selectedNoteIds.value.includes(note.id)) {
          const noteNumber = Math.max(note.noteNumber - 1, 0);
          return {
            ...note,
            noteNumber,
          };
        } else {
          return note;
        }
      });
      if (newNotes.some((note) => note.noteNumber < 0)) {
        return;
      }
      store.dispatch("REPLACE_ALL_NOTES", { notes: newNotes });
    };

    const handleNotesArrowRight = () => {
      const newNotes = state.score.notes.map((note) => {
        if (selectedNoteIds.value.includes(note.id)) {
          const position = note.position + snapTicks.value;
          return {
            ...note,
            position,
          };
        } else {
          return note;
        }
      });
      store.dispatch("REPLACE_ALL_NOTES", { notes: newNotes });
    };

    const handleNotesArrowLeft = () => {
      const newNotes = state.score.notes.map((note) => {
        if (selectedNoteIds.value.includes(note.id)) {
          const position = note.position - snapTicks.value;
          return {
            ...note,
            position,
          };
        } else {
          return note;
        }
      });
      if (newNotes.some((note) => note.position < 0)) {
        return;
      }
      store.dispatch("REPLACE_ALL_NOTES", { notes: newNotes });
    };

    const handleNotesBackspaceOrDelete = () => {
      store.dispatch("REMOVE_SELECTED_NOTES");
    };

    const handleNotesKeydown = (event: KeyboardEvent) => {
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

    const onScroll = (event: Event) => {
      if (event.target instanceof HTMLElement) {
        scrollX.value = event.target.scrollLeft;
        scrollY.value = event.target.scrollTop;
      }
    };

    onMounted(() => {
      const el = document.querySelector("#sequencer-body");
      // 上から2/3の位置がC4になるようにスクロールする
      if (el) {
        const c4BaseY = noteNumberToBaseY(60);
        const clientBaseHeight = el.clientHeight / zoomY.value;
        const scrollBaseY = c4BaseY - clientBaseHeight * (2 / 3);
        el.scrollTo(0, scrollBaseY * zoomY.value);
      }
    });

    return {
      beatsPerMeasure,
      beatWidth,
      gridCellWidth,
      gridCellHeight,
      numOfMeasures,
      numOfGridColumns,
      keyInfos,
      notes,
      zoomX,
      zoomY,
      cursorX,
      cursorY,
      scrollX,
      scrollY,
      setZoomX,
      setZoomY,
      addNote,
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleNotesKeydown,
      handleDragMoveStart,
      handleDragRightStart,
      handleDragLeftStart,
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

  &.move {
    cursor: move;
  }
}

.corner {
  background: #fff;
  border-bottom: 1px solid #ccc;
  border-right: 1px solid #ccc;
}

.sequencer-body {
  backface-visibility: hidden;
  overflow: auto;
  position: relative;
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
