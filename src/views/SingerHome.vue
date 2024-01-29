<template>
  <menu-bar />
  <tool-bar />
  <div class="sing-main">
    <!-- TODO: 複数エンジン対応 -->
    <!-- TODO: allEngineStateが "ERROR" のときエラーになったエンジンを探してトーストで案内 -->
    <div v-if="allEngineState === 'FAILED_STARTING'" class="waiting-engine">
      <div>
        エンジンの起動に失敗しました。エンジンの再起動をお試しください。
      </div>
    </div>
    <div v-else-if="allEngineState === 'STARTING'" class="waiting-engine">
      <div>
        <q-spinner color="primary" size="2.5rem" />
        <div class="q-mt-xs">
          {{
            allEngineState === "STARTING"
              ? "エンジン起動中・・・"
              : "データ準備中・・・"
          }}
        </div>
      </div>
    </div>
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

<script lang="ts">
import { computed, defineComponent, onMounted, watch } from "vue";
import { useStore } from "@/store";
import {
  DEFAULT_BEATS,
  DEFAULT_BEAT_TYPE,
  DEFAULT_BPM,
  DEFAULT_TPQN,
} from "@/sing/storeHelper";
import MenuBar from "@/components/Sing/MenuBar.vue";
import ToolBar from "@/components/Sing/ToolBar.vue";
import ScoreSequencer from "@/components/Sing/ScoreSequencer.vue";
import { EngineState } from "@/store/type";

export default defineComponent({
  name: "SingerHome",
  components: {
    MenuBar,
    ToolBar,
    ScoreSequencer,
  },
  props: {
    projectFilePath: { type: String, default: undefined },
    isEnginesReady: { type: Boolean, required: true },
  },

  setup(props) {
    const store = useStore();
    //const $q = useQuasar();

    // TODO: Talk側のEditorHome.vueと共通化する
    const allEngineState = computed(() => {
      const engineStates = store.state.engineStates;

      let lastEngineState: EngineState | undefined = undefined;

      // 登録されているすべてのエンジンについて状態を確認する
      for (const engineId of store.state.engineIds) {
        const engineState: EngineState | undefined = engineStates[engineId];
        if (engineState == undefined)
          throw new Error(`No such engineState set: engineId == ${engineId}`);

        // FIXME: 1つでも接続テストに成功していないエンジンがあれば、暫定的に起動中とする
        if (engineState === "STARTING") {
          return engineState;
        }

        lastEngineState = engineState;
      }

      return lastEngineState; // FIXME: 暫定的に1つのエンジンの状態を返す
    });

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

    return {
      nowRendering,
      nowAudioExporting,
      cancelExport,
      allEngineState,
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

.waiting-engine {
  background-color: rgba(colors.$display-rgb, 0.15);
  position: absolute;
  inset: 0;
  top: vars.$menubar-height;
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
