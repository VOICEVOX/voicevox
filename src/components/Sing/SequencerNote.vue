<template>
  <div
    :class="classNamesStr"
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
      :height="barHeight"
      :width="barWidth"
      xmlns="http://www.w3.org/2000/svg"
      class="sequencer-note-bar"
      @dblclick.prevent.stop="onBarDoubleClick"
    >
      <g>
        <rect
          y="0"
          x="0"
          height="100%"
          width="100%"
          rx="2"
          ry="2"
          stroke-width="1"
          class="sequencer-note-bar-body"
          @mousedown.stop="onBodyMouseDown"
        />
        <rect
          y="-25%"
          x="-4"
          height="150%"
          width="12"
          fill-opacity="0"
          class="sequencer-note-bar-draghandle"
          @mousedown.stop="onLeftEdgeMouseDown"
        />
        <rect
          y="-25%"
          :x="barWidth - 8"
          width="12"
          height="150%"
          fill-opacity="0"
          class="sequencer-note-bar-draghandle"
          @mousedown.stop="onRightEdgeMouseDown"
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
  getKeyBaseHeight,
  tickToBaseX,
  noteNumberToBaseY,
} from "@/helpers/singHelper";

export default defineComponent({
  name: "SingSequencerNote",
  props: {
    note: { type: Object as PropType<Note>, required: true },
    isSelected: { type: Boolean },
  },
  emits: [
    "bodyMousedown",
    "rightEdgeMousedown",
    "leftEdgeMousedown",
    "BarDblclick",
  ],
  setup(props, { emit }) {
    const store = useStore();
    const state = store.state;
    const tpqn = computed(() => state.score.tpqn);
    const zoomX = computed(() => state.sequencerZoomX);
    const zoomY = computed(() => state.sequencerZoomY);
    const positionX = computed(() => {
      const noteStartTicks = props.note.position;
      return tickToBaseX(noteStartTicks, tpqn.value) * zoomX.value;
    });
    const positionY = computed(() => {
      const noteNumber = props.note.noteNumber;
      return noteNumberToBaseY(noteNumber + 0.5) * zoomY.value;
    });
    const barHeight = computed(() => getKeyBaseHeight() * zoomY.value);
    const barWidth = computed(() => {
      const noteStartTicks = props.note.position;
      const noteEndTicks = props.note.position + props.note.duration;
      const noteStartBaseX = tickToBaseX(noteStartTicks, tpqn.value);
      const noteEndBaseX = tickToBaseX(noteEndTicks, tpqn.value);
      return (noteEndBaseX - noteStartBaseX) * zoomX.value;
    });
    const classNamesStr = computed(() => {
      if (props.isSelected) {
        return "sequencer-note selected";
      }
      if (state.overlappingNoteIds.has(props.note.id)) {
        return "sequencer-note overlapping";
      }
      return "sequencer-note";
    });

    const setLyric = (event: Event) => {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }
      if (event.target.value) {
        const lyric = event.target.value;
        store.dispatch("UPDATE_NOTES", { notes: [{ ...props.note, lyric }] });
      }
    };

    const onBodyMouseDown = (event: MouseEvent) => {
      emit("bodyMousedown", event);
    };

    const onRightEdgeMouseDown = (event: MouseEvent) => {
      emit("rightEdgeMousedown", event);
    };

    const onLeftEdgeMouseDown = (event: MouseEvent) => {
      emit("leftEdgeMousedown", event);
    };

    const onBarDoubleClick = (event: MouseEvent) => {
      emit("BarDblclick", event);
    };

    return {
      zoomX,
      zoomY,
      positionX,
      positionY,
      barHeight,
      barWidth,
      classNamesStr,
      setLyric,
      onBodyMouseDown,
      onRightEdgeMouseDown,
      onLeftEdgeMouseDown,
      onBarDoubleClick,
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

  &.overlapping {
    .sequencer-note-bar-body {
      fill: rgba(colors.$primary-rgb, 0.5);
    }
  }
}

.sequencer-note-lyric {
  background: white;
  border: 0;
  border-bottom: 1px solid colors.$primary;
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
  cursor: move;
}

.sequencer-note-bar-draghandle {
  cursor: ew-resize;
}
</style>
