<template>
  <singer-tab />
  <menu-bar />
  <tool-bar />
  <div class="sing-editor">
    <singer-panel />
    <score />
  </div>
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
import MenuBar from "@/components/Sing/MenuBar.vue";
import ToolBar from "@/components/Sing/ToolBar.vue";
import SingerPanel from "@/components/Sing/SingerPanel.vue";
import Score from "@/components/Sing/Score.vue";

export default defineComponent({
  name: "SingerHome",
  components: { SingerTab, MenuBar, ToolBar, SingerPanel, Score },

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
.sing-editor {
  display: flex;
}
</style>
