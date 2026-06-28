<template>
  <div class="sing-editor">
    <ToolBar
      :toolPaletteLayout
      :sequencerViewport
      @navigateSequencer="navigateSequencer"
    />
    <div class="sing-main">
      <EngineStartupOverlay :isCompletedInitialStartup />
      <ExportOverlay />

      <QSplitter
        :modelValue="0"
        unit="px"
        class="full-width"
        :limits="[200, 300]"
        disable
        :separatorStyle="{ display: 'none' }"
        emitImmediately
      >
        <template #after>
          <!-- full-heightで高さをQSplitterの高さに揃える -->
          <ScoreSequencer
            v-model:toolPaletteLayout="toolPaletteLayout"
            v-model:sequencerViewport="sequencerViewport"
            v-model:sequencerNavigationRequest="sequencerNavigationRequest"
            class="full-height"
          />
        </template>
      </QSplitter>
    </div>
    <PlaybackBar />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import ToolBar from "./ToolBar/ToolBar.vue";
import PlaybackBar from "./PlaybackBar.vue";
import ScoreSequencer, {
  type SequencerNavigationRequest,
  type SequencerViewportState,
} from "./ScoreSequencer.vue";
import EngineStartupOverlay from "@/components/EngineStartupOverlay.vue";
import ExportOverlay from "@/components/Sing/ExportOverlay.vue";
import { useStore } from "@/store";
import onetimeWatch from "@/helpers/onetimeWatch";
import {
  DEFAULT_TPQN,
  createDefaultTempo,
  createDefaultTimeSignature,
} from "@/sing/domain";
import type { ToolPaletteLayout } from "@/components/Sing/toolPaletteLayout";

const props = defineProps<{
  isEnginesReady: boolean;
  isProjectFileLoaded: boolean | "waiting";
}>();

const store = useStore();

const isCompletedInitialStartup = ref(false);
const toolPaletteLayout = ref<ToolPaletteLayout>("sideRight");
const sequencerViewport = ref<SequencerViewportState>({
  clientWidth: 0,
  scrollLeft: 0,
  scrollWidth: 1,
  zoomX: 1,
});
const sequencerNavigationRequest = ref<SequencerNavigationRequest>();
let sequencerNavigationRequestId = 0;
const navigateSequencer = (scrollLeft: number) => {
  sequencerNavigationRequest.value = {
    id: ++sequencerNavigationRequestId,
    scrollLeft,
  };
};
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

.sing-editor {
  display: flex;
  flex-direction: column;
  height: calc(100vh - #{vars.$menubar-height});
  min-height: 0;
}

.sing-main {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  position: relative;
}
</style>
