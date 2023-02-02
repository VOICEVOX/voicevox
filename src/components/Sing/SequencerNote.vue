<template>
  <div
    v-bind:class="`sequencer-note ${isSelected ? 'selected' : ''}`"
    v-bind:style="{
      transform: `translate3d(${positionX}px,${positionY}px,0)`,
    }"
  >
    <!-- NOTE: q-inputへの変更 / 表示面+速度面から、クリック時のみinputを表示に変更予定 -->
    <input
      type="text"
      :value="note.lyric"
      @input="(e) => setLyric(e)"
      class="sequencer-note-lyric"
    />
    <svg
      v-bind:height="`${barHeight}`"
      v-bind:width="`${barWidth}`"
      xmlns="http://www.w3.org/2000/svg"
      class="sequencer-note-bar"
      @mousedown="toggleSelected()"
      @dblclick="removeNote()"
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
    const isSelected = computed(() => {
      return store.state.selectedNotes.includes(props.index);
    });
    const toggleSelected = () => {
      // TODO: Store側で行う
      const selectedNotes = [...store.state.selectedNotes];
      const index = props.index;
      const selectedIndex = selectedNotes.findIndex((i) => i === index);
      if (-1 === selectedIndex) {
        selectedNotes.push(index);
      } else {
        selectedNotes.splice(selectedIndex, 1);
      }
      store.dispatch("SET_SELECTED_NOTES", { selectedNotes });
    };
    const removeNote = () => {
      const index = props.index;
      store.dispatch("REMOVE_NOTE", { index });
    };
    const setLyric = (event: Event) => {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }
      if (event.target.value && store.state.score) {
        const index = props.index;
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
      isSelected,
      toggleSelected,
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

  &.selected {
    .sequencer-note-bar-body {
      fill: darkorange; // 仮
    }
  }
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
