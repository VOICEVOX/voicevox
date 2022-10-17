<template>
  <div class="sing-score-position">シーケンサ上ツールバー</div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "SingScorePosition",

  setup() {
    return null;
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.sing-score-position {
  background: colors.$background;
  border-bottom: 1px solid #ccc;
  height: 32px;
  width: 100%;
}
</style>
