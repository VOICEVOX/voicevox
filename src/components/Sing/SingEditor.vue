<template>
  <ToolBar />
  <div class="sing-main">
    <EngineStartupOverlay :isCompletedInitialStartup />
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
          textColor="display"
          class="q-mt-sm"
          @click="cancelExport"
        />
      </div>
    </div>
    <ScoreSequencer />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ToolBar from "./ToolBar/ToolBar.vue";
import ScoreSequencer from "./ScoreSequencer.vue";
import EngineStartupOverlay from "@/components/EngineStartupOverlay.vue";
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
//const $q = useQuasar();

const nowRendering = computed(() => {
  return store.state.nowRendering;
});
const nowAudioExporting = computed(() => {
  return store.state.nowAudioExporting;
});
const enablePitchEditInSongEditor = computed(() => {
  return store.state.experimentalSetting.enablePitchEditInSongEditor;
});

const cancelExport = () => {
  store.dispatch("CANCEL_AUDIO_EXPORT");
};

watch(enablePitchEditInSongEditor, (value) => {
  if (value === false && store.state.sequencerEditTarget === "PITCH") {
    // ピッチ編集機能が無効になったとき編集ターゲットがピッチだったら、
    // 編集ターゲットをノートに切り替える
    store.dispatch("SET_EDIT_TARGET", { editTarget: "NOTE" });
  }
});

const isCompletedInitialStartup = ref(false);
// TODO: Vueっぽくないので解体する
onetimeWatch(
  () => props.isProjectFileLoaded,
  async (isProjectFileLoaded) => {
    if (isProjectFileLoaded == "waiting" || !props.isEnginesReady)
      return "continue";

    if (!isProjectFileLoaded) {
      await store.dispatch("SET_TPQN", { tpqn: DEFAULT_TPQN });
      await store.dispatch("SET_TEMPOS", { tempos: [createDefaultTempo(0)] });
      await store.dispatch("SET_TIME_SIGNATURES", {
        timeSignatures: [createDefaultTimeSignature(1)],
      });
      await store.dispatch("SET_NOTES", { notes: [] });
      // CI上のe2eテストのNemoエンジンには歌手がいないためエラーになるのでワークアラウンド
      // FIXME: 歌手をいると見せかけるmock APIを作り、ここのtry catchを削除する
      try {
        await store.dispatch("SET_SINGER", { withRelated: true });
      } catch (e) {
        window.backend.logError(e);
      }
    }

    await store.dispatch("SET_VOLUME", { volume: 0.6 });
    await store.dispatch("SET_PLAYHEAD_POSITION", { position: 0 });
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
