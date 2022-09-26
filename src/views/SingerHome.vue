<template>
  <singer-tab />
  <p>Singer Home</p>
</template>

<script lang="ts">
import {
  //computed,
  defineComponent,
  //onBeforeUpdate,
  //onMounted,
  //ref,
  //watch,
} from "vue";
// import { useStore } from "@/store";
// import { QResizeObserver, useQuasar } from "quasar";
// import path from "path";

import SingerTab from "@/components/SingerTab.vue";

export default defineComponent({
  name: "SingerHome",

  components: { SingerTab },

  setup() {
    //const store = useStore();
    //const $q = useQuasar();

    return null;
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.layout-container {
  min-height: calc(100vh - #{vars.$menubar-height});
}
</style>
