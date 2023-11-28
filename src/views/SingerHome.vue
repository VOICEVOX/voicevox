<template>
  <singer-tab />
  <menu-bar />
  <tool-bar />
  <div class="sing-main">
    <div v-if="exportingAudio" class="exporting-dialog">
      <div>
        <q-spinner color="primary" size="2.5rem" />
        <div class="q-mt-xs">
          {{ nowRendering ? "レンダリング中・・・" : "音声を書き出し中・・・" }}
        </div>
        <q-btn
          v-if="nowRendering"
          padding="xs md"
          label="音声の書き出しをキャンセル"
          color="surface"
          text-color="display"
          class="q-mt-sm"
          @click="cancelExport"
        />
      </div>
    </div>
    <singer-panel />
    <score-sequencer />
  </div>
</template>

<script lang="ts">
import {
  computed,
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

    const nowRendering = computed(() => {
      return store.state.nowRendering;
    });
    const exportingAudio = computed(() => {
      return store.state.exportingAudio;
    });

    const cancelExport = () => {
      store.dispatch("CANCEL_AUDIO_EXPORT");
    };

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

      await store.dispatch("SET_VOLUME", { volume: 0.3 });
      await store.dispatch("SET_PLAYHEAD_POSITION", { position: 0 });
      await store.dispatch("SET_LEFT_LOCATOR_POSITION", {
        position: 0,
      });
      await store.dispatch("SET_RIGHT_LOCATOR_POSITION", {
        position: 480 * 4 * 16,
      });
      return {};
    });

    return {
      nowRendering,
      exportingAudio,
      cancelExport,
    };
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

.exporting-dialog {
  background-color: rgba(colors.$display-rgb, 0.15);
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: center;

  > div {
    color: colors.$display;
    background: colors.$surface;
    border-radius: 6px;
    padding: 14px;
  }
}
</style>
