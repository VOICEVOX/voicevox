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
        />
      </div>
      <div
        v-for="(note, index) in notes"
        :key="index"
        v-bind:style="{
          background: '#ddd',
          position: 'absolute',
          border: '1px solid #333',
          left: `${note.position}px`,
          bottom: `${(note.midi + 1) * 24}px`,
          width: `${note.duration}px`,
          height: '24px',
          zIndex: 10,
        }"
      >
        {{ note.midi }}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from "vue";
import { useStore } from "@/store";
import { midiKeys } from "@/helpers/singHelper";

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
        ? Math.min(lastNote.position + lastNote.duration, minDuration)
        : minDuration;
      // NOTE: グリッド幅1/16: 設定できるようにする必要あり
      const gridDuration = resolution / 4;
      return [...Array(Math.ceil(totalDuration / gridDuration)).keys()];
    });
    const notes = computed(() => store.state.score?.notes);
    const timeSignatures = computed(() => store.state.score?.timeSignatures);
    return {
      timeSignatures,
      gridY,
      gridX,
      notes,
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
}
</style>
