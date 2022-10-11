<template>
  <div class="singer-panel" v-bind:class="{ hide: !isShowSinger }" />
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
    const isShowSinger = computed(() => store.state.isShowSinger);
    return {
      isShowSinger,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.singer-panel {
  background: colors.$surface;
  height: 100vh;
  width: 200px;

  &.hide {
    width: 0;
  }
}
</style>
