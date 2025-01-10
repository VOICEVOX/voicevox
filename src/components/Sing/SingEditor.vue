<template>
  <ToolBar />
  <div class="sing-main" :class="{ 'sidebar-open': isSidebarOpen }">
    <EngineStartupOverlay :isCompletedInitialStartup />
    <ExportOverlay />

    <QSplitter
      :modelValue="isSidebarOpen ? sidebarWidth : 0"
      unit="px"
      class="full-width"
      :limits="[200, 300]"
      :disable="!isSidebarOpen"
      :separatorStyle="{ display: isSidebarOpen ? 'block' : 'none' }"
      emitImmediately
      @update:modelValue="setSidebarWidth"
    >
      <template #before>
        <SideBar v-if="isSidebarOpen" />
      </template>
      <template #after>
        <!-- full-heightで高さをQSplitterの高さに揃える -->
        <ScoreSequencer class="full-height" />
      </template>
    </QSplitter>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ToolBar from "./ToolBar/ToolBar.vue";
import ScoreSequencer from "./ScoreSequencer.vue";
import SideBar from "./SideBar/SideBar.vue";
import EngineStartupOverlay from "@/components/EngineStartupOverlay.vue";
import ExportOverlay from "@/components/Sing/ExportOverlay.vue";
import { useStore } from "@/store";
import onetimeWatch from "@/helpers/onetimeWatch";
import {
  DEFAULT_TPQN,
  createDefaultTempo,
  createDefaultTimeSignature,
} from "@/sing/domain";

const props = defineProps<{
  isEnginesReady: boolean;
  isProjectFileLoaded: boolean | "waiting";
}>();

const store = useStore();

const isSidebarOpen = computed(() => store.state.isSongSidebarOpen);
const sidebarWidth = ref(300);

const setSidebarWidth = (width: number) => {
  if (isSidebarOpen.value) {
    sidebarWidth.value = width;
  }
};

// トラック数が1から増えたら、サイドバーを開く
watch(
  () => store.state.tracks.size,
  (tracksSize, oldTracksSize) => {
    if (oldTracksSize <= 1 && tracksSize > 1) {
      void store.actions.SET_SONG_SIDEBAR_OPEN({ isSongSidebarOpen: true });
    }
  },
);

const isCompletedInitialStartup = ref(false);
// TODO: Vueっぽくないので解体する
onetimeWatch(
  () => props.isProjectFileLoaded,
  async (isProjectFileLoaded) => {
    if (isProjectFileLoaded == "waiting" || !props.isEnginesReady)
      return "continue";

    if (!isProjectFileLoaded) {
      await store.actions.SET_TPQN({ tpqn: DEFAULT_TPQN });
      await store.actions.SET_TEMPOS({ tempos: [createDefaultTempo(0)] });
      await store.actions.SET_TIME_SIGNATURES({
        timeSignatures: [createDefaultTimeSignature(1)],
      });
      const trackId = store.state.trackOrder[0];
      await store.actions.SET_NOTES({ notes: [], trackId });
      // CI上のe2eテストのNemoエンジンには歌手がいないためエラーになるのでワークアラウンド
      // FIXME: 歌手をいると見せかけるmock APIを作り、ここのtry catchを削除する
      try {
        await store.actions.SET_SINGER({
          trackId,
          withRelated: true,
        });
      } catch (e) {
        window.backend.logError(e);
      }
    }

    await store.actions.SET_VOLUME({ volume: 0.6 });
    await store.actions.SET_PLAYHEAD_POSITION({ position: 0 });
    await store.actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS();
    isCompletedInitialStartup.value = true;

    return "unwatch";
  },
  {
    immediate: true,
  },
);
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.layout-container {
  min-height: calc(100vh - #{vars.$menubar-height});
}
.sing-main {
  display: flex;
  overflow: hidden;
  position: relative;
}
</style>
