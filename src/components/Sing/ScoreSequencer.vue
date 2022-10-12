<template>
  <div class="score-sequencer">
    <div class="score-sequencer-keys" />
    シーケンサ
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, ComputedRef } from "vue";
import { useStore } from "@/store";
import { useQuasar } from "quasar";
import { HotkeyAction, HotkeyReturnType } from "@/type/preload";
import { setHotkeyFunctions } from "@/store/setting";

export default defineComponent({
  name: "SingScoreSequencer",

  setup() {
    const store = useStore();
    const $q = useQuasar();
    // const pitches = [...Array(128).keys()].reverse();
    // return { pitches };
    return null;
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;
</style>
