<template>
  <singer-tab />
  <menu-bar />
  <tool-bar />
  <div class="sing-main">
    <singer-panel />
    <score-sequencer />
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
import {
  DEFAULT_BEATS,
  DEFAULT_BEAT_TYPE,
  DEFAULT_BPM,
  DEFAULT_TPQN,
} from "@/helpers/singHelper";

export default defineComponent({
  name: "SingerHome",
  components: {
    SingerTab,
    MenuBar,
    ToolBar,
    SingerPanel,
    ScoreSequencer,
  },

  setup() {
    const store = useStore();
    //const $q = useQuasar();

    // 歌声合成エディターの初期化
    onMounted(async () => {
      await store.dispatch("SET_SCORE", {
        score: {
          tpqn: DEFAULT_TPQN,
          tempos: [
            {
              position: 0,
              bpm: DEFAULT_BPM,
            },
          ],
          timeSignatures: [
            {
              measureNumber: 1,
              beats: DEFAULT_BEATS,
              beatType: DEFAULT_BEAT_TYPE,
            },
          ],
          notes: [],
        },
      });
      await store.dispatch("SET_SINGER", {});

      await store.dispatch("SET_VOLUME", { volume: 0.6 });
      await store.dispatch("SET_PLAYHEAD_POSITION", { position: 0 });
      await store.dispatch("SET_LEFT_LOCATOR_POSITION", {
        position: 0,
      });
      await store.dispatch("SET_RIGHT_LOCATOR_POSITION", {
        position: 480 * 4 * 16,
      });
      await store.dispatch("SET_RENDERING_ENABLED", { renderingEnabled: true });
      return {};
    });
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
  overflow: hidden;
}
</style>
