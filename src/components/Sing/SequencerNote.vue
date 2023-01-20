<template>
  <div
    class="sequencer-note"
    v-bind:style="{
      transform: `translate3d(${positionX}px,${positionY}px,0)`,
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
      v-bind:height="`${barHeight}`"
      v-bind:width="`${barWidth}`"
      xmlns="http://www.w3.org/2000/svg"
      class="sequencer-note-bar"
      @dblclick="removeNote(index)"
    >
      <g>
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
</template>

<script lang="ts">
import { defineComponent, computed, PropType } from "vue";
import { useStore } from "@/store";
import { Note } from "@/store/type";
import {
  BASE_GRID_SIZE_X as sizeX,
  BASE_GRID_SIZE_Y as sizeY,
} from "@/helpers/singHelper";

export default defineComponent({
  name: "SingSequencerNote",
  props: {
    note: { type: Object as PropType<Note>, required: true },
    index: { type: Number, required: true },
  },
  setup(props) {
    const store = useStore();
    const zoomX = computed(() => store.state.sequencerZoomX);
    const zoomY = computed(() => store.state.sequencerZoomY);
    const positionX = computed(() => (props.note.position / 4) * zoomX.value);
    const positionY = computed(
      () => (127 - props.note.midi) * sizeY * zoomY.value
    );
    const barHeight = computed(() => sizeY * zoomY.value);
    const barWidth = computed(() => (props.note.duration / 4) * zoomX.value);
    const removeNote = (index: number) => {
      store.dispatch("REMOVE_NOTE", { index });
    };
    const setLyric = (index: number, event: Event) => {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }
      if (event.target.value && store.state.score) {
        const lyric = event.target.value;
        store.dispatch("CHANGE_NOTE", {
          index,
          note: {
            ...props.note,
            lyric,
          },
        });
      }
    };
    return {
      sizeX,
      sizeY,
      zoomX,
      zoomY,
      positionX,
      positionY,
      barHeight,
      barWidth,
      removeNote,
      setLyric,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

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
