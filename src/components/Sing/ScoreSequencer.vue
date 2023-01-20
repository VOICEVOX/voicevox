<template>
  <div class="score-sequencer" id="score-sequencer">
    <!-- 鍵盤 -->
    <sequencer-keys />
    <!-- シーケンサ -->
    <div class="sequencer-body">
      <!-- グリッド -->
      <!-- NOTE: 現状小節+オクターブごとの罫線なし -->
      <svg
        v-bind:height="`${sizeY * zoomY * 128}`"
        v-bind:width="`${gridX.length * sizeX * zoomX}`"
        xmlns="http://www.w3.org/2000/svg"
        class="sequencer-grids"
        @click="(e) => addNote(e)"
      >
        <defs>
          <pattern
            id="sequencer-grid-16"
            v-bind:width="`${sizeX * zoomX}px`"
            v-bind:height="`${12 * sizeY * zoomY}px`"
            patternUnits="userSpaceOnUse"
          >
            <rect
              v-for="(y, index) in gridY"
              :key="index"
              x="0"
              v-bind:y="`${sizeY * zoomY * index}`"
              v-bind:width="`${sizeX * zoomX}`"
              v-bind:height="`${sizeY * zoomY}`"
              v-bind:class="`sequencer-grids-col sequencer-grids-col-${y.color}`"
            />
          </pattern>
          <!-- NOTE: 4/4 1小節でグリッド見た目確認目的 -->
          <pattern
            id="sequencer-grid-measure"
            v-bind:width="`${sizeX * 16 * zoomX}`"
            v-bind:height="`${12 * sizeY * zoomY}`"
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
        v-bind:note="note"
        v-bind:index="index"
      />
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
    onMounted(() => {
      const el = document.querySelector("#score-sequencer");
      // C4あたりにスクロールする
      if (el) {
        el.scrollTop = scrollY.value * (sizeY * zoomY.value);
      }
    });
    const addNote = (event: MouseEvent) => {
      const resolution = store.state.score?.resolution;
      const gridXSize = resolution ? resolution / 4 : 120;
      const position =
        gridXSize * Math.floor(event.offsetX / (sizeX * zoomX.value));
      const midi = 127 - Math.floor(event.offsetY / (sizeX * zoomY.value));
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
      sizeX,
      sizeY,
      getPitchFromMidi,
      addNote,
      setZoomX,
      setZoomY,
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
