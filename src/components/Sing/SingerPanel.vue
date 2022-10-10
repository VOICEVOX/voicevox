<template>
  <div class="singer-panel" />
</template>

<script lang="ts">
import { defineComponent, ref, computed, ComputedRef } from "vue";
import { useStore } from "@/store";
import { useQuasar } from "quasar";
import { HotkeyAction, HotkeyReturnType } from "@/type/preload";
import { setHotkeyFunctions } from "@/store/setting";

export default defineComponent({
  name: "SingSingerPanel",

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

.singer-panel {
  background: colors.$surface;
  border-right: 1px solid #ccc;
  height: 100vh;
  width: 200px;
}
</style>
