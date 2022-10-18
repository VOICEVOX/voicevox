<template>
  <singer-tab />
  <menu-bar />
  <tool-bar />
  <div class="sing-main">
    <singer-panel />
    <div class="sing-editor">
      <score-position />
      <score-sequencer />
    </div>
  </div>
</template>

<script lang="ts">
import {
  //computed,
  defineComponent,
  //onBeforeUpdate,
  onMounted,
  //ref,
  //watch,
} from "vue";
import { useStore } from "@/store";
// import { QResizeObserver, useQuasar } from "quasar";
// import path from "path";

import SingerTab from "@/components/SingerTab.vue";
import MenuBar from "@/components/Sing/MenuBar.vue";
import ToolBar from "@/components/Sing/ToolBar.vue";
import SingerPanel from "@/components/Sing/SingerPanel.vue";
import ScoreSequencer from "@/components/Sing/ScoreSequencer.vue";
import ScorePosition from "@/components/Sing/ScorePosition.vue";

export default defineComponent({
  name: "SingerHome",
  components: {
    SingerTab,
    MenuBar,
    ToolBar,
    SingerPanel,
    ScoreSequencer,
    ScorePosition,
  },

  setup() {
    const store = useStore();
    //const $q = useQuasar();

    // 歌声合成エディターの初期化
    onMounted(async () => {
      await store.dispatch("SET_SINGER", {});

      const score = await store.dispatch("GET_DEFAULT_SCORE");

      // 実装時の確認用です TODO: 必要なくなったら削除
      score.notes = [
        { position: 0, duration: 480, midi: 60, lyric: "ら" },
        { position: 480, duration: 480, midi: 62, lyric: "ら" },
        { position: 960, duration: 480, midi: 64, lyric: "ら" },
        { position: 1440, duration: 480, midi: 65, lyric: "ら" },
        { position: 1920, duration: 1920, midi: 67, lyric: "ら" },
      ];

      await store.dispatch("SET_SCORE", { score });
    });
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
.sing-main {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.sing-editor {
  width: 100%;
}
</style>
