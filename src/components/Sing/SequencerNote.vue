<template>
  <div
    class="note"
    :style="{
      transform: `translate3d(${positionX}px,${positionY}px,0)`,
    }"
  >
    <!-- NOTE: q-inputへの変更 / 表示面+速度面から、クリック時のみinputを表示に変更予定 -->
    <input
      type="text"
      :value="note.lyric"
      class="note-lyric"
      @input="setLyric"
    />
    <div
      class="note-bar"
      :class="{
        selected: noteState === 'SELECTED',
        overlapping: noteState === 'OVERLAPPING',
      }"
      :style="{
        width: `${barWidth}px`,
        height: `${barHeight}px`,
      }"
      @mousedown.stop="onBarMouseDown"
    >
      <div class="note-left-edge" @mousedown.stop="onLeftEdgeMouseDown"></div>
      <div class="note-right-edge" @mousedown.stop="onRightEdgeMouseDown"></div>
    </div>
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

type NoteState = "NONE" | "SELECTED" | "OVERLAPPING";

export default defineComponent({
  name: "SingSequencerNote",
  props: {
    note: { type: Object as PropType<Note>, required: true },
    isSelected: { type: Boolean },
  },
  emits: ["bodyMousedown", "rightEdgeMousedown", "leftEdgeMousedown"],
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
    const noteState = computed((): NoteState => {
      if (props.isSelected) {
        return "SELECTED";
      }
      if (state.overlappingNoteIds.has(props.note.id)) {
        return "OVERLAPPING";
      }
      return "NONE";
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

    const onBarMouseDown = (event: MouseEvent) => {
      emit("bodyMousedown", event);
    };

    const onRightEdgeMouseDown = (event: MouseEvent) => {
      emit("rightEdgeMousedown", event);
    };

    const onLeftEdgeMouseDown = (event: MouseEvent) => {
      emit("leftEdgeMousedown", event);
    };

    return {
      zoomX,
      zoomY,
      positionX,
      positionY,
      barHeight,
      barWidth,
      noteState,
      setLyric,
      onBarMouseDown,
      onRightEdgeMouseDown,
      onLeftEdgeMouseDown,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.note {
  position: absolute;
  top: 0;
  left: 0;
}

.note-lyric {
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

.note-bar {
  position: relative;
  background-color: colors.$primary;
  border-color: rgba(255, 255, 255, 0.5);
  border-width: 1px;
  border-radius: 2px;
  cursor: move;

  &.selected {
    background-color: darkorange; // 仮
  }

  &.overlapping {
    background-color: rgba(colors.$primary-rgb, 0.5);
  }
}

.note-left-edge {
  position: absolute;
  top: 0;
  left: -6px;
  width: 12px;
  height: 100%;
  cursor: ew-resize;
}

.note-right-edge {
  position: absolute;
  top: 0;
  right: -6px;
  width: 12px;
  height: 100%;
  cursor: ew-resize;
}
</style>
