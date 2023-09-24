<template>
  <div
    :class="`sequencer-note ${isSelected ? 'selected' : ''}`"
    :style="{
      transform: `translate3d(${positionX}px,${positionY}px,0)`,
    }"
  >
    <!-- NOTE: q-inputへの変更 / 表示面+速度面から、クリック時のみinputを表示に変更予定 -->
    <input
      type="text"
      :value="note.lyric"
      class="sequencer-note-lyric"
      @input="setLyric"
    />
    <svg
      :height="`${barHeight}`"
      :width="`${barWidth}`"
      xmlns="http://www.w3.org/2000/svg"
      class="sequencer-note-bar"
      focusable="true"
      tabindex="0"
      @dblclick.prevent="removeNote"
      @keydown.prevent="handleKeydown"
    >
      <g>
        <rect
          y="0"
          x="0"
          height="100%"
          width="100%"
          stroke-width="1"
          class="sequencer-note-bar-body"
          @mousedown.stop="handleMouseDown"
        />
        <rect
          y="-25%"
          x="-4"
          height="150%"
          width="12"
          fill-opacity="0"
          class="sequencer-note-bar-draghandle"
          @mousedown.stop="handleDragLeftStart"
        />
        <rect
          y="-25%"
          :x="`${(note.duration / 4) * zoomX - 4}`"
          width="16"
          height="150%"
          fill-opacity="0"
          class="sequencer-note-bar-draghandle"
          @mousedown.stop="handleDragRightStart"
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
    cursorX: { type: Number },
    cursorY: { type: Number },
  },

  emits: [
    "handleNotesKeydown",
    "handleDragMoveStart",
    "handleDragRightStart",
    "handleDragLeftStart",
  ],

  setup(props, { emit }) {
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
      return store.state.selectedNoteIds.includes(props.note.id);
    });

    const removeNote = () => {
      store.dispatch("REMOVE_NOTE", { id: props.note.id });
    };

    const setLyric = (event: InputEvent) => {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }
      if (event.target.value) {
        const lyric = event.target.value;
        store.dispatch("UPDATE_NOTE", {
          note: {
            ...props.note,
            lyric,
          },
        });
      }
    };

    const handleKeydown = (event: KeyboardEvent) => {
      emit("handleNotesKeydown", event);
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (!store.state.selectedNoteIds.includes(props.note.id)) {
        const noteIds = [...store.state.selectedNoteIds, props.note.id];
        store.dispatch("SET_SELECTED_NOTE_IDS", {
          noteIds,
        });
      } else {
        emit("handleDragMoveStart", event);
      }
    };

    const handleDragRightStart = (event: MouseEvent) => {
      const noteIds = [...store.state.selectedNoteIds, props.note.id];
      store.dispatch("SET_SELECTED_NOTE_IDS", {
        noteIds,
      });
      emit("handleDragRightStart", event);
    };

    const handleDragLeftStart = (event: MouseEvent) => {
      const noteIds = [...store.state.selectedNoteIds, props.note.id];
      store.dispatch("SET_SELECTED_NOTE_IDS", {
        noteIds,
      });
      emit("handleDragLeftStart", event);
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
      removeNote,
      setLyric,
      handleKeydown,
      handleDragRightStart,
      handleDragLeftStart,
      handleMouseDown,
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
      cursor: move;
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
