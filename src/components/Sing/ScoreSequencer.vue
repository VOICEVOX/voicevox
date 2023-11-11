<template>
  <div class="score-sequencer">
    <!-- 左上の角 -->
    <div class="corner"></div>
    <!-- ルーラー -->
    <sequencer-ruler :offset="scrollX" :num-of-measures="numOfMeasures" />
    <!-- 鍵盤 -->
    <sequencer-keys :offset="scrollY" :black-key-width="30" />
    <!-- シーケンサ -->
    <div
      ref="sequencerBody"
      class="sequencer-body"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @dblclick="addNote"
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
      <div
        class="sequencer-body-playhead-wrapper"
        :style="{
          width: `${gridWidth}px`,
          height: `${gridHeight}px`,
        }"
      >
        <div
          class="sequencer-body-playhead"
          :style="{
            transform: `translateX(${playheadX}px)`,
          }"
        ></div>
      </div>
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
  setup() {
    const ZOOM_X_MIN = 0.2;
    const ZOOM_X_MAX = 1;
    const ZOOM_X_STEP = 0.05;
    const ZOOM_Y_MIN = 0.35;
    const ZOOM_Y_MAX = 1;
    const ZOOM_Y_STEP = 0.05;

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
    const selectedNoteIds = computed(() => state.selectedNoteIds);

    const sequencerBody = ref<HTMLElement | null>(null);

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
      const sequencerBodyElement = sequencerBody.value;
      if (event.target instanceof HTMLInputElement && sequencerBodyElement) {
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
      if (event.target instanceof HTMLInputElement && sequencerBodyElement) {
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

    const onWheel = (event: WheelEvent) => {
      const sequencerBodyElement = sequencerBody.value;
      if (sequencerBodyElement && event.ctrlKey) {
        // カーソル位置を基準に水平方向のズームを行う
        const oldZoomX = zoomX.value;
        const scrollLeft = sequencerBodyElement.scrollLeft;
        const scrollTop = sequencerBodyElement.scrollTop;
        const cursorX = event.offsetX - scrollLeft;

        let newZoomX = zoomX.value;
        newZoomX -= event.deltaY * (ZOOM_X_STEP * 0.01);
        newZoomX = Math.min(ZOOM_X_MAX, newZoomX);
        newZoomX = Math.max(ZOOM_X_MIN, newZoomX);

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
      if (sequencerBodyElement) {
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

      store.dispatch("ADD_PLAYHEAD_POSITION_CHANGE_LISTENER", {
        listener: playheadPositionChangeListener,
      });
    });

    onUnmounted(() => {
      store.dispatch("REMOVE_PLAYHEAD_POSITION_CHANGE_LISTENER", {
        listener: playheadPositionChangeListener,
      });
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
      cursorX,
      cursorY,
      scrollX,
      scrollY,
      playheadX,
      sequencerBody,
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

.corner {
  background: #fff;
  border-bottom: 1px solid #ccc;
  border-right: 1px solid #ccc;
}

.sequencer-body {
  backface-visibility: hidden;
  overflow: auto;
  position: relative;

  &.move {
    cursor: move;
  }
}

.sequencer-body-playhead-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  overflow: hidden;
  pointer-events: none;
}

.sequencer-body-playhead {
  position: absolute;
  top: 0;
  left: -2px;
  width: 4px;
  height: 100%;
  background: colors.$primary;
  border-left: 1px solid rgba(colors.$background-rgb, 0.83);
  border-right: 1px solid rgba(colors.$background-rgb, 0.83);
  pointer-events: none;
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
