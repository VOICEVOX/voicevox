<template>
  <div class="score-sequencer">
    <div class="sequencer-keys">
      <div
        v-for="key in displayKeys"
        :key="key.midi"
        :class="`sequencer-key sequencer-key-${key.color} ${
          key.pitch === 'C' ? 'sequencer-key-octave' : ''
        } ${key.pitch === 'F' || key.pitch === 'D' ? 'sequencer-key-f' : ''}`"
        :id="`sequencer-key-${key.midi}`"
        :title="key.name"
      >
        {{ key.pitch === "C" ? key.name : "" }}
      </div>
    </div>
    <div class="sequencer-grid-y">
      <div
        v-for="key in displayKeys"
        :key="key.midi"
        :class="`sequencer-y sequencer-y-${key.color} ${
          key.pitch === 'C' ? 'sequencer-y-octave' : ''
        } ${key.pitch === 'F' ? 'sequencer-y-f' : ''}`"
        :id="`sequencer-y-${key.midi}`"
      />
    </div>
    <div
      v-for="(note, index) in notes"
      :key="index"
      v-bind:style="{
        background: '#ddd',
        position: 'relative',
        left: `${note.position}px`,
        bottom: `${(note.midi + 1) * 24}px`,
        width: `${note.duration}px`,
        height: '24px',
        zIndex: 100,
      }"
    >
      {{ note.midi }}
    </div>
    <div class="sequencer-grid-x" />
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";
import { midiKeys } from "@/helpers/singHelper";

export default defineComponent({
  name: "SingScoreSequencer",

  setup() {
    const store = useStore();
    const displayKeys = midiKeys.reverse();
    const notes = computed(() => store.state.score?.notes);
    const timeSignatures = computed(() => store.state.score?.timeSignatures);
    return {
      displayKeys,
      timeSignatures,
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
  padding-left: 64px;
  position: relative;
  height: 100%;
  width: auto;
}
.sequencer-keys {
  background: white;
  border-right: 1px solid #ccc;
  position: absolute;
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
  position: relative;
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
