<template>
  <menu-bar />
  <tool-bar />
  <div class="sing-main">
    <engine-startup-overlay :is-completed-initial-startup="isEnginesReady" />
    <div v-if="nowAudioExporting" class="exporting-dialog">
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
    <score-sequencer />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useStore } from "@/store";
import {
  DEFAULT_BEATS,
  DEFAULT_BEAT_TYPE,
  DEFAULT_BPM,
  DEFAULT_TPQN,
} from "@/sing/storeHelper";
import EngineStartupOverlay from "@/components/EngineStartupOverlay.vue";
import MenuBar from "@/components/Sing/MenuBar.vue";
import ToolBar from "@/components/Sing/ToolBar.vue";
import ScoreSequencer from "@/components/Sing/ScoreSequencer.vue";

const props = withDefaults(
  defineProps<{
    projectFilePath?: string;
    isEnginesReady: boolean;
  }>(),
  {
    projectFilePath: undefined,
    isEnginesReady: false,
  }
);

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

  await store.dispatch("SET_VOLUME", { volume: 0.6 });
  await store.dispatch("SET_PLAYHEAD_POSITION", { position: 0 });
  await store.dispatch("SET_LEFT_LOCATOR_POSITION", {
    position: 0,
  });
  await store.dispatch("SET_RIGHT_LOCATOR_POSITION", {
    position: 480 * 4 * 16,
  });
  return {};
});

// エンジン初期化後の処理
const unwatchIsEnginesReady = watch(
  // TODO: 最初に１度だけ実行している。Vueっぽくないので解体する
  () => props.isEnginesReady,
  async (isEnginesReady) => {
    if (!isEnginesReady) return;

    await store.dispatch("SET_SINGER", {});

    unwatchIsEnginesReady();
  },
  {
    immediate: true,
  }
);
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.layout-container {
  min-height: calc(100vh - #{vars.$menubar-height});
}
.sing-main {
  display: flex;
  flex-direction: column;
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
