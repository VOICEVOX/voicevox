<template>
  <div class="score-sequencer">
    <div class="score-sequencer-keys" />
    シーケンサ
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "SingScoreSequencer",

  setup() {
    return null;
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;
</style>
