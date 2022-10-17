<template>
  <div class="sing-singer-panel" v-bind:class="{ hide: !isShowSinger }">
    シンガーの表示
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";

export default defineComponent({
  name: "SingSingerPanel",

  setup() {
    const store = useStore();
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

.sing-singer-panel {
  background: colors.$background;
  border-right: 1px solid #ccc;
  height: 100%;
  width: 200px;

  &.hide {
    display: none;
  }
}
</style>
