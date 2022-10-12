<template>
  <div class="sing-score-position">シーケンサ上ツールバー</div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, ComputedRef } from "vue";
import { useStore } from "@/store";
import { useQuasar } from "quasar";
import { HotkeyAction, HotkeyReturnType } from "@/type/preload";
import { setHotkeyFunctions } from "@/store/setting";

export default defineComponent({
  name: "SingScorePosition",

  setup() {
    const store = useStore();
    const $q = useQuasar();
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
