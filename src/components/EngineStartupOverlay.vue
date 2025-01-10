<template>
  <!-- TODO: 複数エンジン対応 -->
  <!-- TODO: allEngineStateが "ERROR" のときエラーになったエンジンを探してトーストで案内 -->
  <div v-if="allEngineState === 'FAILED_STARTING'" class="waiting-engine">
    <div>エンジンの起動に失敗しました。エンジンの再起動をお試しください。</div>
  </div>
  <div
    v-else-if="
      !props.isCompletedInitialStartup || allEngineState === 'STARTING'
    "
    class="waiting-engine"
  >
    <div>
      <QSpinner color="primary" size="2.5rem" />
      <div class="q-mt-xs">
        {{
          allEngineState === "STARTING"
            ? "エンジン起動中・・・"
            : "データ準備中・・・"
        }}
      </div>

      <template v-if="isEngineWaitingLong">
        <QSeparator spaced />
        エンジン起動に時間がかかっています。<br />
        <QBtn
          v-if="isMultipleEngine"
          outline
          :disable="reloadingLocked"
          @click="reloadAppWithMultiEngineOffMode"
        >
          マルチエンジンをオフにして再読み込みする</QBtn
        >
        <QBtn v-else outline @click="openQa">Q&Aを見る</QBtn>
      </template>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useStore } from "@/store";
import { EngineState } from "@/store/type";

const store = useStore();
const props = defineProps<{
  isCompletedInitialStartup: boolean;
}>();

const reloadingLocked = computed(() => store.state.reloadingLock);
const isMultipleEngine = computed(() => store.state.engineIds.length > 1);

// エンジン待機
// TODO: 個別のエンジンの状態をUIで確認できるようにする
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

const isEngineWaitingLong = ref<boolean>(false);
let engineTimer: number | undefined = undefined;
watch(allEngineState, (newEngineState) => {
  if (engineTimer != undefined) {
    clearTimeout(engineTimer);
    engineTimer = undefined;
  }
  if (newEngineState === "STARTING") {
    isEngineWaitingLong.value = false;
    engineTimer = window.setTimeout(() => {
      isEngineWaitingLong.value = true;
    }, 30000);
  } else {
    isEngineWaitingLong.value = false;
  }
});

const reloadAppWithMultiEngineOffMode = () => {
  void store.actions.CHECK_EDITED_AND_NOT_SAVE({
    closeOrReload: "reload",
    isMultiEngineOffMode: true,
  });
};

const openQa = () => {
  window.open("https://voicevox.hiroshiba.jp/qa/", "_blank");
};
</script>

<style scoped lang="scss">
@use "@/styles/colors" as colors;
@use "@/styles/variables" as vars;

.waiting-engine {
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
