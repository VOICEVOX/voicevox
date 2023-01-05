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
      >
        <div
          v-for="y in gridY"
          :key="y.midi"
          :class="`sequencer-cell ${y.color} ${
            y.pitch === 'C' ? 'key-c' : ''
          } ${y.pitch === 'F' ? 'key-f' : ''}`"
          :id="`sequencer-cell-${x}-${y.midi}`"
          @click="addNote(x, y.midi)"
        />
      </div>
      <div
        v-for="(note, index) in notes"
        :key="index"
        class="sequencer-note"
        @dblclick="removeNote(index)"
        v-bind:style="{
          left: `${note.position}px`,
          bottom: `${note.midi * 24}px`,
          width: `${note.duration}px`,
          height: '24px',
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
  height: 24px;
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
  width: 120px;
}

.sequencer-cell {
  border-bottom: 1px solid #ddd;
  flex-shrink: 0;
  height: 24px;

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
  height: 24px;
  padding: 0 4px;
  width: 100%;
}
</style>
