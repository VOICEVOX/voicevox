<template>
  <div class="score-note">
    <div
      class="score-note-bar"
      v-bind:style="{
        left: `${position}px`,
        bottom: `${(midi + 1) * 24}px`,
        width: `${duration}px`,
        height: '24px',
        zIndex: 100,
      }"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";

export default defineComponent({
  name: "SingScoreNote",

  props: {
    position: { type: Number, required: true },
    duration: { type: Number, required: true },
    midi: { type: Number, required: true },
    lyric: { type: String, required: false },
  },

  setup(props) {
    const store = useStore();
    return null;
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.score-note-bar {
  background: #ddd;
  border: 1px solid #555;
  position: relative;
}
</style>
