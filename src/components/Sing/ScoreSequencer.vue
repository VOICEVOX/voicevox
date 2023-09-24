<template>
  <div
    id="score-sequencer"
    class="score-sequencer"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @dblclick="addNote"
  >
    <!-- 鍵盤 -->
    <sequencer-keys />
    <!-- シーケンサ -->
    <div class="sequencer-body">
      <!-- グリッド -->
      <!-- NOTE: 現状小節+オクターブごとの罫線なし -->
      <svg
        :height="`${sizeY * zoomY * 128}`"
        :width="`${gridX.length * sizeX * zoomX}`"
        xmlns="http://www.w3.org/2000/svg"
        class="sequencer-grids"
      >
        <!-- パターングリッド -->
        <defs>
          <pattern
            id="sequencer-grid-16"
            :width="`${sizeX * zoomX}px`"
            :height="`${12 * sizeY * zoomY}px`"
            patternUnits="userSpaceOnUse"
          >
            <rect
              v-for="(y, index) in gridY"
              :key="index"
              x="0"
              :y="`${sizeY * zoomY * index}`"
              :width="`${sizeX * zoomX}`"
              :height="`${sizeY * zoomY}`"
              :class="`sequencer-grids-col sequencer-grids-col-${y.color}`"
            />
          </pattern>
          <!-- NOTE: 4/4 1小節でグリッド見た目確認目的 -->
          <pattern
            id="sequencer-grid-measure"
            :width="`${sizeX * 16 * zoomX}`"
            :height="`${12 * sizeY * zoomY}`"
            patternUnits="userSpaceOnUse"
          >
            <rect width="100%" height="100%" fill="url(#sequencer-grid-16)" />
            <line
              x="100%"
              x2="0"
              y1="0"
              y2="100%"
              stroke-width="1"
              fill="none"
              class="sequencer-grid-separator-line"
            />
          </pattern>
        </defs>
        <rect
          id="sequencer-grid"
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
        bottom: '8px',
        right: '16px',
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
        bottom: '64px',
        right: '-8px',
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
import SequencerKeys from "@/components/Sing/SequencerKeys.vue";
import SequencerNote from "@/components/Sing/SequencerNote.vue";
import {
  midiKeys,
  getPitchFromMidi,
  getDoremiFromMidi,
  BASE_GRID_SIZE_X as sizeX,
  BASE_GRID_SIZE_Y as sizeY,
} from "@/helpers/singHelper";

export default defineComponent({
  name: "SingScoreSequencer",
  components: {
    SequencerKeys,
    SequencerNote,
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
    // シーケンサグリッド
    const gridY = midiKeys;
    const gridX = computed(() => {
      const resolution = state.score?.resolution || 480;
      // NOTE: 最低長: 仮32小節...MIDI長さ(曲長さ)が決まっていないため、無限スクロール化する or 最後尾に足した場合は伸びるようにするなど？
      const minDuration = resolution * 4 * 32;
      const lastNote = state.score?.notes.slice(-1)[0];
      // Score長さ: スコア長もしくは最低長のうち長い方
      const totalDuration = lastNote
        ? Math.max(lastNote.position + lastNote.duration, minDuration)
        : minDuration;
      // グリッド幅1/16
      const gridDuration = resolution / 4;
      // NOTE: いったん最後尾に足した場合は伸びるようにする
      const gridsMax = Math.ceil(totalDuration / gridDuration) + 16;
      return [...Array(gridsMax).keys()].map(
        (gridNum) => gridNum * gridDuration
      );
    });
    // ノート
    const notes = computed(() => state.score?.notes);
    // 表紙
    const timeSignatures = computed(() => state.score?.timeSignatures);
    // ズーム状態
    const zoomX = computed(() => state.sequencerZoomX);
    const zoomY = computed(() => state.sequencerZoomY);
    // スナップサイズ
    const snapSize = computed(() => state.sequencerSnapSize);
    const snapWidth = computed(() => (snapSize.value / 4) * zoomX.value);
    // グリッドサイズ
    const gridWidth = computed(() => sizeX * zoomX.value);
    const gridHeight = computed(() => sizeY * zoomY.value);
    // スクロール位置
    // const scrollX = computed(() => state.sequencerScrollX);
    const scrollY = computed(() => state.sequencerScrollY);
    const selectedNoteIds = computed(() => state.selectedNoteIds);

    // ノートの追加
    const addNote = (event: MouseEvent) => {
      const resolution = state.score?.resolution;
      const gridXSize = resolution ? resolution / 4 : snapSize.value;
      const position =
        gridXSize * Math.floor(event.offsetX / (sizeX * zoomX.value));
      const midi = 127 - Math.floor(event.offsetY / (sizeY * zoomY.value));
      if (0 > midi) {
        return;
      }
      // NOTE: ノートの追加は1/8をベース
      const duration = gridXSize * 2;
      const lyric = getDoremiFromMidi(midi);
      // NOTE: 仮ID
      const id = uuidv4();
      store.dispatch("ADD_NOTE", {
        note: {
          id,
          position,
          midi,
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
      if (!state.score) {
        throw new Error("Score is undefined.");
      }
      if (dragMode.value !== DragMode.MOVE) {
        cancelAnimationFrame(dragId.value);
        return;
      }
      // X方向, Y方向の移動距離
      const distanceX = cursorX.value - dragMoveCurrentX.value;
      const distanceY = cursorY.value - dragMoveCurrentY.value;

      // カーソル位置に応じてノート移動量を計算
      let amountPositionX = 0;
      if (gridWidth.value <= Math.abs(distanceX)) {
        amountPositionX = 0 < distanceX ? snapSize.value : -snapSize.value;
        const dragMoveCurrentXNext =
          dragMoveCurrentX.value +
          (0 < amountPositionX ? gridWidth.value : -gridWidth.value);
        dragMoveCurrentX.value = dragMoveCurrentXNext;
      }
      let amountPositionY = 0;
      if (gridHeight.value <= Math.abs(distanceY)) {
        amountPositionY = 0 < distanceY ? -1 : 1;
        const dragMoveCurrentYNext =
          dragMoveCurrentY.value +
          (0 > amountPositionY ? gridHeight.value : -gridHeight.value);
        dragMoveCurrentY.value = dragMoveCurrentYNext;
      }

      // 選択中のノートのpositionとmidiを変更
      let isNotesChanged = false;
      const newNotes = [...state.score.notes].map((note) => {
        if (selectedNoteIds.value.includes(note.id)) {
          if (amountPositionX === 0 && amountPositionY === 0) {
            return note;
          }
          isNotesChanged = true;
          const position = note.position + amountPositionX;
          const midi = note.midi + amountPositionY;
          return {
            ...note,
            midi,
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
      if (!state.score) {
        throw new Error("Score is undefined.");
      }
      if (dragMode.value !== DragMode.NOTE_RIGHT) {
        cancelAnimationFrame(dragId.value);
        return;
      }
      const distanceX = cursorX.value - dragDurationCurrentX.value;
      if (snapWidth.value <= Math.abs(distanceX)) {
        let isNotesChanged = false;
        const newNotes = [...state.score.notes].map((note) => {
          if (selectedNoteIds.value.includes(note.id)) {
            const duration =
              note.duration +
              (0 < distanceX ? snapSize.value : -snapSize.value);
            if (duration < Math.max(snapSize.value, 0) || note.position < 0) {
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
      if (!state.score) {
        throw new Error("Score is undefined.");
      }
      if (dragMode.value !== DragMode.NOTE_LEFT) {
        cancelAnimationFrame(dragId.value);
        return;
      }
      const distanceX = cursorX.value - dragDurationCurrentX.value;
      if (snapWidth.value <= Math.abs(distanceX)) {
        let isNotesChanged = false;
        const newNotes = [...state.score.notes].map((note) => {
          if (selectedNoteIds.value.includes(note.id)) {
            const position =
              note.position +
              (0 < distanceX ? snapSize.value : -snapSize.value);
            const duration =
              note.duration +
              (0 > distanceX ? snapSize.value : -snapSize.value);
            if (duration < Math.max(snapSize.value, 0) || note.position < 0) {
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
      if (!state.score) {
        throw new Error("Score is undefined.");
      }
      const newNotes = state.score.notes.map((note) => {
        if (selectedNoteIds.value.includes(note.id)) {
          const midi = Math.min(note.midi + 1, 127);
          return {
            ...note,
            midi,
          };
        } else {
          return note;
        }
      });
      if (newNotes.some((note) => note.midi > 127)) {
        return;
      }
      store.dispatch("REPLACE_ALL_NOTES", { notes: newNotes });
    };

    const handleNotesArrowDown = () => {
      if (!state.score) {
        throw new Error("Score is undefined.");
      }
      const newNotes = state.score.notes.map((note) => {
        if (selectedNoteIds.value.includes(note.id)) {
          const midi = Math.max(note.midi - 1, 0);
          return {
            ...note,
            midi,
          };
        } else {
          return note;
        }
      });
      if (newNotes.some((note) => note.midi < 0)) {
        return;
      }
      store.dispatch("REPLACE_ALL_NOTES", { notes: newNotes });
    };

    const handleNotesArrowRight = () => {
      if (!state.score) {
        throw new Error("Score is undefined.");
      }
      const newNotes = state.score.notes.map((note) => {
        if (selectedNoteIds.value.includes(note.id)) {
          const position = note.position + snapSize.value;
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
      if (!state.score) {
        throw new Error("Score is undefined.");
      }
      const newNotes = state.score.notes.map((note) => {
        if (selectedNoteIds.value.includes(note.id)) {
          const position = note.position - snapSize.value;
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

    onMounted(() => {
      const el = document.querySelector("#score-sequencer");
      // C4あたりにスクロールする
      if (el) {
        el.scrollTop = scrollY.value * (sizeY * zoomY.value);
      }
    });

    return {
      timeSignatures,
      gridY,
      gridX,
      notes,
      zoomX,
      zoomY,
      sizeX,
      sizeY,
      cursorX,
      cursorY,
      getPitchFromMidi,
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
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.score-sequencer {
  backface-visibility: hidden;
  display: block;
  height: 100%;
  overflow: auto;
  padding-bottom: 164px;
  position: relative;
  width: 100%;

  &.move {
    cursor: move;
  }
}

.sequencer-body {
  backface-visibility: hidden;
  display: block;
  position: absolute;
  height: 100%;
  width: 100%;
  top: 0;
  left: 48px;
  padding-bottom: 164px;
}

.sequencer-grids {
  display: block;
}

.sequencer-grids-col {
  display: block;
  stroke: #e8e8e8;
  stroke-width: 1;
}

.sequencer-grids-col-white {
  fill: #fff;
}

.sequencer-grids-col-black {
  fill: #f2f2f2;
}

.sequencer-grid-separator-line {
  backface-visibility: hidden;
  stroke: #b0b0b0;
}
</style>
