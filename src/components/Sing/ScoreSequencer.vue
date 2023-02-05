<template>
  <div class="score-sequencer" id="score-sequencer">
    <!-- 鍵盤表示 -->
    <svg
      width="48"
      v-bind:height="`${BASE_Y_SIZE * zoomY * 128}`"
      xmlns="http://www.w3.org/2000/svg"
      class="sequencer-keys"
    >
      <g v-for="(y, index) in gridY" :key="index">
        <rect
          x="0"
          v-bind:y="`${BASE_Y_SIZE * zoomY * index}`"
          v-bind:width="`${y.color === 'black' ? 30 : 48}`"
          v-bind:height="`${BASE_Y_SIZE * zoomY}`"
          v-bind:class="`sequencer-keys-item-${y.color}`"
          v-bind:title="y.name"
        />
        <line
          x1="0"
          v-bind:y1="`${(index + 1) * BASE_Y_SIZE * zoomY}`"
          x2="48"
          v-bind:y2="`${(index + 1) * BASE_Y_SIZE * zoomY}`"
          stroke-width="1"
          v-bind:class="`sequencer-keys-item-separator ${
            y.pitch === 'C' && 'sequencer-keys-item-separator-octave'
          } ${y.pitch === 'F' && 'sequencer-keys-item-separator-f'}`"
          v-if="y.pitch === 'C' || y.pitch === 'F'"
        />
        <text
          font-size="10"
          x="32"
          v-bind:y="`${BASE_Y_SIZE * zoomY * (index + 1) - 4}`"
          v-if="y.pitch === 'C'"
          class="sequencer-keys-item-pitchname"
        >
          {{ y.name }}
        </text>
      </g>
    </svg>
    <div class="sequencer-body">
      <!-- グリッド -->
      <!-- NOTE: 現状小節+オクターブごとの罫線なし -->
      <svg
        v-bind:height="`${BASE_Y_SIZE * zoomY * 128}`"
        v-bind:width="`${gridX.length * BASE_X_SIZE * zoomX}`"
        xmlns="http://www.w3.org/2000/svg"
        class="sequencer-grids"
      >
        <defs>
          <pattern
            id="sequencer-grid-16"
            v-bind:width="`${BASE_X_SIZE * zoomX}px`"
            v-bind:height="`${12 * BASE_Y_SIZE * zoomY}px`"
            patternUnits="userSpaceOnUse"
          >
            <rect
              v-for="(y, index) in gridY"
              :key="index"
              x="0"
              v-bind:y="`${BASE_Y_SIZE * zoomY * index}`"
              v-bind:width="`${BASE_X_SIZE * zoomX}`"
              v-bind:height="`${BASE_Y_SIZE * zoomY}`"
              v-bind:class="`sequencer-grids-col sequencer-grids-col-${y.color}`"
            />
          </pattern>
          <!-- NOTE: 4/4 1小節でグリッド見た目確認目的 -->
          <pattern
            id="sequencer-grid-measure"
            v-bind:width="`${BASE_X_SIZE * 16 * zoomX}`"
            v-bind:height="`${12 * BASE_Y_SIZE * zoomY}`"
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
          @mousedown="(e) => addNote(e)"
        />
      </svg>
      <!-- NOTE: ノートと歌詞入力あわせコンポーネント分割予定 -->
      <div
        v-for="(note, index) in notes"
        :key="index"
        class="sequencer-note"
        v-bind:style="{
          transform: `translate3d(${(note.position / 4) * zoomX}px,${
            (127 - note.midi) * BASE_Y_SIZE * zoomY
          }px,0)`,
        }"
      >
        <!-- NOTE: q-inputへの変更 / 表示面+速度面から、クリック時のみinputを表示に変更予定 -->
        <input
          type="text"
          :value="note.lyric"
          @input="(e) => setLyric(index, e)"
          class="sequencer-note-lyric"
        />
        <svg
          v-bind:height="`${BASE_Y_SIZE * zoomY}`"
          v-bind:width="`${(note.duration / 4) * zoomX}`"
          xmlns="http://www.w3.org/2000/svg"
          class="sequencer-note-bar"
        >
          <g @dblclick="removeNote(index)">
            <rect
              y="0"
              x="0"
              height="100%"
              width="100%"
              stroke-width="1"
              class="sequencer-note-bar-body"
            />
            <rect
              y="0"
              x="-4"
              height="100%"
              width="8"
              fill-opacity="0"
              draggable
              class="sequencer-note-bar-draghandle"
            />
            <rect
              y="0"
              v-bind:x="`${(note.duration / 4) * zoomX - 4}`"
              height="100%"
              width="8"
              fill-opacity="0"
              class="sequencer-note-bar-draghandle"
              draggable
            />
          </g>
        </svg>
      </div>
    </div>
    <!-- NOTE: スクロールバー+ズームレンジ仮 -->
    <input
      type="range"
      min="0.2"
      max="1"
      step="0.05"
      :value="zoomX"
      @input="(e) => setZoomX(e)"
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
      @input="(e) => setZoomY(e)"
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
import { defineComponent, computed, onMounted } from "vue";
import { useStore } from "@/store";
import {
  midiKeys,
  getPitchFromMidi,
  getDoremiFromMidi,
} from "@/helpers/singHelper";

export default defineComponent({
  name: "SingScoreSequencer",
  setup() {
    const store = useStore();
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
    const notes = computed(() => store.state.score?.notes);
    const timeSignatures = computed(() => store.state.score?.timeSignatures);
    const zoomX = computed(() => store.state.sequencerZoomX);
    const zoomY = computed(() => store.state.sequencerZoomY);
    const scrollX = computed(() => store.state.sequencerScrollX);
    const scrollY = computed(() => store.state.sequencerScrollY);
    const BASE_Y_SIZE = 30;
    const BASE_X_SIZE = 30;
    onMounted(() => {
      const el = document.querySelector("#score-sequencer");
      // C4あたりにスクロールする
      if (el) {
        el.scrollTop = scrollY.value * (BASE_Y_SIZE * zoomY.value);
      }
    });
    const addNote = (event: MouseEvent) => {
      const resolution = store.state.score?.resolution;
      const gridXSize = resolution ? resolution / 4 : 120;
      const position =
        gridXSize * Math.floor(event.offsetX / (BASE_X_SIZE * zoomX.value));
      const midi =
        127 - Math.floor(event.offsetY / (BASE_Y_SIZE * zoomY.value));
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
    const removeNote = (index: number) => {
      store.dispatch("REMOVE_NOTE", { index });
    };
    // NOTE: ノートのバーと歌詞入力でコンポーネント分割予定
    const setLyric = (index: number, event: Event) => {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }
      if (event.target.value && store.state.score) {
        const currentNote = store.state.score?.notes[index];
        const lyric = event.target.value;
        store.dispatch("CHANGE_NOTE", {
          index,
          note: {
            ...currentNote,
            lyric,
          },
        });
      }
    };
    const setZoomX = (event: Event) => {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }
      store.dispatch("SET_ZOOM_X", {
        zoomX: Number(event.target.value),
      });
    };
    const setZoomY = (event: Event) => {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }
      store.dispatch("SET_ZOOM_Y", {
        zoomY: Number(event.target.value),
      });
    };
    return {
      timeSignatures,
      gridY,
      gridX,
      notes,
      zoomX,
      zoomY,
      getPitchFromMidi,
      addNote,
      removeNote,
      setLyric,
      setZoomX,
      setZoomY,
      BASE_X_SIZE,
      BASE_Y_SIZE,
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

.sequencer-keys {
  backface-visibility: hidden;
  background: #fff;
  display: block;
  position: sticky;
  left: 0;
  z-index: 100;
}

.sequencer-keys-item-separator-octave {
  stroke: #bbb;
}

.sequencer-keys-item-separator-f {
  stroke: #ddd;
}

.sequencer-keys-item-white {
  fill: #fff;
}

.sequencer-keys-item-black {
  fill: #555;
}

.sequencer-keys-item-pitchname {
  fill: #555;
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

.sequencer-note {
  backface-visibility: hidden;
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0, 0;
}

.sequencer-note-lyric {
  background: white;
  border: 0;
  border-bottom: 1px solid colors.$primary-light;
  color: colors.$display;
  font-size: 12px;
  font-weight: bold;
  font-feature-settings: "palt" 1;
  letter-spacing: 0.05em;
  outline: none;
  padding: 0;
  position: absolute;
  bottom: calc(100% - 1px);
  left: 0;
  width: 24px;
}

.sequencer-note-bar {
  display: block;
  position: relative;
}
.sequencer-note-bar-body {
  fill: colors.$primary;
  stroke: #fff;
  stroke-opacity: 0.5;
  position: relative;
  top: 0;
  left: 0;
}

.sequencer-note-bar-draghandle {
  cursor: ew-resize;
}
</style>
