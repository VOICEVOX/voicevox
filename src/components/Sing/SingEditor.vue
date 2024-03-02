<template>
  <MenuBar />
  <ToolBar />
  <div class="sing-main">
    <EngineStartupOverlay
      :is-completed-initial-startup="isCompletedInitialStartup"
    />
    <div v-if="nowAudioExporting" class="exporting-dialog">
      <div>
        <QSpinner color="primary" size="2.5rem" />
        <div class="q-mt-xs">
          {{ nowRendering ? "レンダリング中・・・" : "音声を書き出し中・・・" }}
        </div>
        <QBtn
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
    <ScoreSequencer :is-activated="isActivated" />
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, ref } from "vue";
import MenuBar from "./MenuBar.vue";
import ToolBar from "./ToolBar.vue";
import ScoreSequencer from "./ScoreSequencer.vue";
import EngineStartupOverlay from "@/components/EngineStartupOverlay.vue";
import { useStore } from "@/store";
import onetimeWatch from "@/helpers/onetimeWatch";
import {
  DEFAULT_BEATS,
  DEFAULT_BEAT_TYPE,
  DEFAULT_BPM,
  DEFAULT_TPQN,
} from "@/sing/storeHelper";

const props =
  defineProps<{
    isEnginesReady: boolean;
    isProjectFileLoaded: boolean | "waiting";
  }>();

const store = useStore();
//const $q = useQuasar();

const nowRendering = computed(() => {
  return store.state.nowRendering;
});
const nowAudioExporting = computed(() => {
  return store.state.nowAudioExporting;
});

const cancelExport = () => {
  store.dispatch("CANCEL_AUDIO_EXPORT");
};

const isCompletedInitialStartup = ref(false);
// TODO: Vueっぽくないので解体する
onetimeWatch(
  () => props.isProjectFileLoaded,
  async (isProjectFileLoaded) => {
    if (isProjectFileLoaded == "waiting" || !props.isEnginesReady)
      return "continue";

    if (!isProjectFileLoaded) {
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
    }

    await store.dispatch("SET_VOLUME", { volume: 0.6 });
    await store.dispatch("SET_PLAYHEAD_POSITION", { position: 0 });
    await store.dispatch("SET_LEFT_LOCATOR_POSITION", {
      position: 0,
    });
    await store.dispatch("SET_RIGHT_LOCATOR_POSITION", {
      position: 480 * 4 * 16,
    });
    isCompletedInitialStartup.value = true;

    await store.dispatch("SET_SINGER", {});

    return "unwatch";
  },
  {
    immediate: true,
  }
);

const isActivated = ref(false);

onActivated(() => {
  isActivated.value = true;
});

onDeactivated(() => {
  isActivated.value = false;
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
  position: relative;
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
