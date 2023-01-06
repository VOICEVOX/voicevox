<template>
  <div class="score-sequencer">
    <div class="sequencer-keys">
      <div
        v-for="y in gridY"
        :key="y.midi"
        :class="`sequencer-key ${y.color} ${y.pitch === 'C' ? 'key-c' : ''} ${
          y.pitch === 'F' ? 'key-f' : ''
        }`"
        :id="`sequencer-key-${y.midi}`"
        :title="y.name"
        v-bind:style="{
          height: `${24 * zoomY}px`,
        }"
      >
        {{ y.pitch === "C" ? y.name : "" }}
      </div>
    </div>
    <div class="sequencer-grids">
      <div
        v-for="x in gridX"
        :key="x"
        :class="`sequencer-row`"
        :id="`sequencer-row-${x}`"
        v-bind:style="{
          width: `${120 * zoomX}px`,
        }"
      >
        <div
          v-for="y in gridY"
          :key="y.midi"
          :class="`sequencer-cell ${y.color} ${
            y.pitch === 'C' ? 'key-c' : ''
          } ${y.pitch === 'F' ? 'key-f' : ''}`"
          :id="`sequencer-cell-${x}-${y.midi}`"
          @click="addNote(x, y.midi)"
          v-bind:style="{
            height: `${24 * zoomY}px`,
          }"
        />
      </div>
      <div
        v-for="(note, index) in notes"
        :key="index"
        class="sequencer-note"
        @dblclick="removeNote(index)"
        v-bind:style="{
          left: `${note.position * zoomX}px`,
          bottom: `${note.midi * 24 * zoomY}px`,
          width: `${note.duration * zoomX}px`,
          height: `${24 * zoomY}px`,
        }"
      >
        <input
          type="text"
          class="sequencer-note-lyric"
          :value="note.lyric"
          @input="(e) => setLyric(index, e)"
        />
        <div class="sequencer-note-bar" />
      </div>
    </div>
    <input
      type="range"
      min="0.1"
      max="1"
      step="0.1"
      :value="zoomX"
      @change="(e) => setZoomX(e)"
      v-bind:style="{
        position: 'fixed',
        zIndex: 10000,
        bottom: '8px',
        right: '16px',
      }"
    />
    <input
      type="range"
      min="0.1"
      max="1"
      step="0.1"
      :value="zoomY"
      @change="(e) => setZoomY(e)"
      v-bind:style="{
        position: 'fixed',
        zIndex: 10000,
        bottom: '96px',
        right: '-32px',
        transform: 'rotate(-90deg)',
      }"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
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
      // NOTE: 最低幅: 仮
      const minDuration = resolution * 4 * 16;
      const lastNote = store.state.score?.notes.slice(-1)[0];
      const totalDuration = lastNote
        ? Math.max(lastNote.position + lastNote.duration, minDuration)
        : minDuration;
      // NOTE: グリッド幅1/16: 設定できるようにする必要あり
      const gridDuration = resolution / 4;
      return [...Array(Math.ceil(totalDuration / gridDuration)).keys()].map(
        (gridNum) => gridNum * gridDuration
      );
    });
    const notes = computed(() => store.state.score?.notes);
    const timeSignatures = computed(() => store.state.score?.timeSignatures);
    const zoomX = computed(() => store.state.sequencerZoomX);
    const zoomY = computed(() => store.state.sequencerZoomY);

    const addNote = (position: number, midi: number) => {
      // NOTE: フォーカスなど動作変更
      store.dispatch("ADD_NOTE", {
        note: {
          position,
          midi,
          duration: 120,
          lyric: getDoremiFromMidi(midi),
        },
      });
    };

    const removeNote = (index: number) => {
      store.dispatch("REMOVE_NOTE", { index });
    };

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
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.score-sequencer {
  display: block;
  overflow: auto;
  margin-left: 0;
  padding-left: 0;
  position: relative;
  height: 100%;
  width: auto;
}
.sequencer-keys {
  background: white;
  border-right: 1px solid #ccc;
  position: sticky;
  left: 0;
  width: 64px;
  z-index: 100;
}

.sequencer-key {
  align-items: center;
  box-sizing: border-box;
  color: #555;
  display: flex;
  font-size: 10px;
  text-align: right;
  padding-left: 4px;
  position: relative;

  &:last-child {
    border-bottom: 1px solid solid #ccc;
  }

  &.white {
    background: white;
  }

  &.black {
    background: #555;

    &:before {
      background: white;
      content: "";
      display: block;
      height: 24px;
      position: absolute;
      width: 16px;
      right: 0;
    }

    &:after {
      background: #ddd;
      content: "";
      display: block;
      height: 1px;
      position: absolute;
      right: 0;
      width: 16px;
      top: 12px;
    }
  }

  &.key-c {
    border-bottom: 1px solid #ccc;
  }

  &.key-f {
    border-bottom: 1px solid #ddd;
  }
}

.sequencer-grids {
  display: flex;
  position: absolute;
  top: 0;
  left: 64px;
}

.sequencer-row {
  border-right: 1px solid #ddd;
  flex-shrink: 0;
}

.sequencer-cell {
  border-bottom: 1px solid #ddd;
  flex-shrink: 0;

  &.black {
    background: #f2f2f2;
  }

  &.key-c {
    border-bottom: 1px solid #ccc;
  }

  &:hover {
    background: rgba(colors.$primary-light-rgb, 0.5);
    cursor: pointer;
  }
}

.sequencer-note {
  position: absolute;
}

.sequencer-note-lyric {
  background: white;
  border: 0;
  border: 1px solid colors.$primary-light;
  border-radius: 2px 2px 0 0;
  font-weight: bold;
  outline: none;
  position: absolute;
  top: -20px;
  left: 4px;
  width: 3rem;
}

.sequencer-note-bar {
  background: colors.$primary;
  border-radius: 2px;
  padding: 0 4px;
  height: 100%;
  width: 100%;
}
</style>
