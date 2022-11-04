<template>
  <div class="score-sequencer">
    <div class="sequencer-keys">
      <div
        v-for="note in displayNotes"
        :key="note.midi"
        :class="`sequencer-key sequencer-key-${note.color} ${
          note.pitch === 'C' ? 'sequencer-key-octave' : ''
        } ${note.pitch === 'F' ? 'sequencer-key-f' : ''}`"
        :id="`sequencer-key-${note.midi}`"
      >
        {{ note.pitch === "C" ? note.name : "" }}
      </div>
    </div>
    <div class="sequencer-grid-y">
      <div
        v-for="note in displayNotes"
        :key="note.midi"
        :class="`sequencer-y sequencer-y-${note.color} ${
          note.pitch === 'C' ? 'sequencer-y-octave' : ''
        } ${note.pitch === 'F' ? 'sequencer-y-f' : ''}`"
        :id="`sequencer-y-${note.midi}`"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { midiNotes } from "@/helpers/singHelper";

export default defineComponent({
  name: "SingScoreSequencer",

  setup() {
    const displayNotes = midiNotes.reverse();
    return {
      displayNotes,
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
  position: relative;
  height: 640px; // 仮
}
.sequencer-keys {
  background: white;
  border-right: 1px solid #ccc;
  position: sticky;
  top: 0;
  left: 0;
  width: 64px;
  z-index: 10;
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

  &.sequencer-key-white {
    background: white;
  }

  &.sequencer-key-black {
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

  &.sequencer-key-octave {
    border-bottom: 1px solid #ccc;
  }

  &.sequencer-key-f {
    border-bottom: 1px solid #ddd;
  }
}

.sequencer-grid-y {
  min-width: 100%;
  position: absolute;
  top: 0;
}

.sequencer-y {
  border-bottom: 1px solid #ddd;
  height: 24px;

  &.sequencer-y-black {
    background: #f2f2f2;
  }

  &.sequencer-y-octave {
    border-bottom: 1px solid #ccc;
  }
}
</style>
