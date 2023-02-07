<template>
  <div
    class="score-sequencer"
    id="score-sequencer"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
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
          x="0"
          y="0"
          width="100%"
          height="100%"
          id="sequencer-grid"
          fill="url(#sequencer-grid-measure)"
        />
      </svg>
      <sequencer-note
        v-for="(note, index) in notes"
        :key="index"
        :note="note"
        :index="index"
        :cursorX="cursorX"
        :cursorY="cursorY"
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
      @input="setZoomX"
      v-bind:style="{
        position: 'fixed',
        zIndex: 10000,
        bottom: '8px',
        right: '16px',
        width: '80px',
      }"
    />
    <input
      type="range"
      min="0.25"
      max="1"
      step="0.05"
      :value="zoomY"
      @input="setZoomY"
      v-bind:style="{
        position: 'fixed',
        zIndex: 10000,
        bottom: '64px',
        right: '-8px',
        transform: 'rotate(-90deg)',
        width: '80px',
      }"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref, onMounted } from "vue";
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
    const store = useStore();
    // カーソルポジション
    const cursorX = ref(0);
    const cursorY = ref(0);
    // ドラッグ状態
    const dragId = ref(0);
    const dragMode = ref();
    const dragMoveStartX = ref();
    const dragMoveStartY = ref();
    const dragDurationStartX = ref();
    // シーケンサグリッド
    const gridY = midiKeys;
    const gridX = computed(() => {
      const resolution = store.state.score?.resolution || 480;
      // NOTE: 最低長: 仮32小節...MIDI長さ(曲長さ)が決まっていないため、無限スクロール化する or 最後尾に足した場合は伸びるようにするなど？
      const minDuration = resolution * 4 * 32;
      const lastNote = store.state.score?.notes.slice(-1)[0];
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
    const notes = computed(() => store.state.score?.notes);
    // 表紙
    const timeSignatures = computed(() => store.state.score?.timeSignatures);
    // ズーム状態
    const zoomX = computed(() => store.state.sequencerZoomX);
    const zoomY = computed(() => store.state.sequencerZoomY);
    // スナップサイズ
    const snapSize = computed(() => store.state.sequencerSnapSize);
    const snapWidth = computed(() => (snapSize.value / 4) * zoomX.value);
    // グリッドサイズ
    const gridWidth = computed(() => sizeX * zoomX.value);
    const gridHeight = computed(() => sizeY * zoomY.value);
    // スクロール位置
    // const scrollX = computed(() => store.state.sequencerScrollX);
    const scrollY = computed(() => store.state.sequencerScrollY);
    const selectedNotes = computed(() => store.state.selectedNotes);

    // ノートの追加
    const addNote = (event: MouseEvent) => {
      const resolution = store.state.score?.resolution;
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
      store.dispatch("ADD_NOTE", {
        note: {
          position,
          midi,
          duration,
          lyric,
        },
      });
    };

    // マウスダウン
    // 選択中のノートがある場合は選択リセット / 無い場合はノート追加
    const handleMouseDown = (event: MouseEvent) => {
      if (0 < selectedNotes.value.length) {
        store.dispatch("CLEAR_SELECTED_NOTES");
      } else {
        addNote(event);
      }
    };

    // マウス移動
    // ドラッグ中の場合はカーソル位置を保持
    const handleMouseMove = (event: MouseEvent) => {
      if (store.state.isDrag) {
        cursorX.value = event.clientX;
        cursorY.value = event.clientY;
      }
    };

    // マウスアップ
    // ドラッグしていた場合はドラッグを終了
    const handleMouseUp = () => {
      cancelAnimationFrame(dragId.value);
      store.dispatch("SET_IS_DRAG", { isDrag: false });
      return;
    };

    // ドラッグでのノートの移動
    const dragMove = () => {
      if (dragMode.value !== "move") {
        cancelAnimationFrame(dragId.value);
        return;
      }
      if (!store.state.score?.notes) {
        return;
      }
      const distanceX = cursorX.value - dragMoveStartX.value;
      const distanceY = cursorY.value - dragMoveStartY.value;
      let amountPositionX = 0;
      if (gridWidth.value <= Math.abs(distanceX)) {
        amountPositionX = 0 < distanceX ? snapSize.value : -snapSize.value;
        const dragStartXNext =
          dragMoveStartX.value +
          (0 < amountPositionX ? gridWidth.value : -gridWidth.value);
        dragMoveStartX.value = dragStartXNext;
      }
      let amountPositionY = 0;
      if (gridHeight.value <= Math.abs(distanceY)) {
        amountPositionY = 0 < distanceY ? -1 : 1;
        const dragStartYNext =
          dragMoveStartY.value +
          (0 > amountPositionY ? gridHeight.value : -gridHeight.value);
        dragMoveStartY.value = dragStartYNext;
      }
      const newNotes = [...store.state.score.notes].map((note, index) => {
        if (selectedNotes.value.includes(index)) {
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
      store.dispatch("SET_ALL_NOTES", { notes: newNotes });
      dragId.value = requestAnimationFrame(dragMove);
    };

    // ノートドラッグ開始
    const handleDragMoveStart = (event: MouseEvent) => {
      if (store.state.selectedNotes.length) {
        dragMode.value = "move";
        dragMoveStartX.value = event.clientX;
        dragMoveStartY.value = event.clientY;
        store.dispatch("SET_IS_DRAG", { isDrag: true });
        dragId.value = requestAnimationFrame(dragMove);
      }
    };

    // ノート右ドラッグ
    const dragRight = () => {
      if (!store.state.score || !store.state.score.notes) {
        return;
      }
      if (dragMode.value !== "note-right") {
        cancelAnimationFrame(dragId.value);
        return;
      }
      const distanceX = cursorX.value - dragDurationStartX.value;
      if (snapWidth.value <= Math.abs(distanceX)) {
        const newNotes = [...store.state.score.notes].map((note, index) => {
          if (selectedNotes.value.includes(index)) {
            const duration =
              note.duration +
              (0 < distanceX ? snapSize.value : -snapSize.value);
            return {
              ...note,
              duration,
            };
          } else {
            return note;
          }
        });
        store.dispatch("SET_ALL_NOTES", { notes: newNotes });
        const dragDurationStartXNext =
          dragDurationStartX.value +
          (0 < distanceX ? snapWidth.value : -snapWidth.value);
        dragDurationStartX.value = dragDurationStartXNext;
      }
      dragId.value = requestAnimationFrame(dragRight);
    };

    // ノート右ドラッグ開始
    const handleDragRightStart = (event: MouseEvent) => {
      dragMode.value = "note-right";
      dragDurationStartX.value = event.clientX;
      store.dispatch("SET_IS_DRAG", { isDrag: true });
      dragId.value = requestAnimationFrame(dragRight);
    };

    // ノート左ドラッグ
    const dragLeft = () => {
      if (!store.state.score) {
        return;
      }
      if (dragMode.value !== "note-left") {
        cancelAnimationFrame(dragId.value);
        return;
      }
      const distanceX = cursorX.value - dragDurationStartX.value;
      if (snapWidth.value <= Math.abs(distanceX)) {
        const newNotes = [...store.state.score.notes].map((note, index) => {
          if (selectedNotes.value.includes(index)) {
            const position =
              note.position +
              (0 < distanceX ? snapSize.value : -snapSize.value);
            const duration =
              note.duration +
              (0 > distanceX ? snapSize.value : -snapSize.value);
            return {
              ...note,
              position,
              duration,
            };
          } else {
            return note;
          }
        });
        store.dispatch("SET_ALL_NOTES", { notes: newNotes });
        const dragDurationStartXNext =
          dragDurationStartX.value +
          (0 < distanceX ? snapWidth.value : -snapWidth.value);
        dragDurationStartX.value = dragDurationStartXNext;
      }
      dragId.value = requestAnimationFrame(dragLeft);
    };

    // ノート左ドラッグ開始
    const handleDragLeftStart = (event: MouseEvent) => {
      dragMode.value = "note-left";
      dragDurationStartX.value = event.clientX;
      store.dispatch("SET_IS_DRAG", { isDrag: true });
      dragId.value = requestAnimationFrame(dragLeft);
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
      if (!store.state.score) {
        return;
      }
      const newNotes = store.state.score.notes.map((note, index) => {
        if (selectedNotes.value.includes(index)) {
          const midi = Math.min(note.midi + 1, 127);
          return {
            ...note,
            midi,
          };
        } else {
          return note;
        }
      });
      store.dispatch("SET_ALL_NOTES", { notes: newNotes });
    };

    const handleNotesArrowDown = () => {
      if (!store.state.score) {
        return;
      }
      const newNotes = store.state.score.notes.map((note, index) => {
        if (selectedNotes.value.includes(index)) {
          const midi = Math.max(note.midi - 1, 0);
          return {
            ...note,
            midi,
          };
        } else {
          return note;
        }
      });
      store.dispatch("SET_ALL_NOTES", { notes: newNotes });
    };

    const handleNotesArrowRight = () => {
      if (!store.state.score) {
        return;
      }
      const newNotes = store.state.score.notes.map((note, index) => {
        if (selectedNotes.value.includes(index)) {
          const position = note.position + snapSize.value;
          return {
            ...note,
            position,
          };
        } else {
          return note;
        }
      });
      store.dispatch("SET_ALL_NOTES", { notes: newNotes });
    };

    const handleNotesArrowLeft = () => {
      if (!store.state.score) {
        return;
      }
      const newNotes = store.state.score.notes.map((note, index) => {
        if (selectedNotes.value.includes(index)) {
          const position = note.position - snapSize.value;
          return {
            ...note,
            position,
          };
        } else {
          return note;
        }
      });
      store.dispatch("SET_ALL_NOTES", { notes: newNotes });
    };

    const handleNotesBackspaceOrDelete = () => {
      if (!store.state.score) {
        return;
      }
      store.dispatch("REMOVE_NOTES", { noteIndices: selectedNotes.value });
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
        case "Backspace" || "Delete":
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
