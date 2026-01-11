<template>
  <ErrorBoundary>
    <TooltipProvider disableHoverableContent :delayDuration="500">
      Welcome画面TODO

      <div>
        <div v-if="latestEngineInfos">
          <div
            v-for="(engineInfo, index) in latestEngineInfos"
            :key="index"
            class="q-mb-md"
          >
            <div class="text-h6">{{ engineInfo.package.engineName }}</div>
            <div>最新バージョン: {{ engineInfo.package.latestVersion }}</div>
            <div>状態: {{ engineInfo.installed.status }}</div>
            <button @click="installEngine(engineInfo.package.engineId)">
              インストール
            </button>
            <div v-if="engineProgressInfo[engineInfo.package.engineId]">
              <span>
                {{
                  progressTypeLabel(
                    engineProgressInfo[engineInfo.package.engineId].type,
                  )
                }}
              </span>
              <progress
                :value="
                  engineProgressInfo[engineInfo.package.engineId].progress
                "
                max="100"
              />
              <span>
                {{
                  Math.floor(
                    engineProgressInfo[engineInfo.package.engineId].progress,
                  )
                }}%
              </span>
            </div>
          </div>
        </div>
        <div v-else>最新のエンジン情報を取得中...</div>
      </div>

      <button @click="launchMainWindow">メインウィンドウを起動</button>
    </TooltipProvider>
  </ErrorBoundary>
</template>

<script setup lang="ts">
import { TooltipProvider } from "reka-ui";
import { onMounted, ref } from "vue";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import { EnginePackageStatus } from "@/backend/electron/engineAndVvppController";
import { EngineId } from "@/type/preload";

const latestEngineInfos = ref<EnginePackageStatus[] | undefined>(undefined);
type EngineProgressInfo = {
  progress: number;
  type: "download" | "install";
};
const engineProgressInfo = ref<Record<EngineId, EngineProgressInfo>>(
  {} as Record<EngineId, EngineProgressInfo>,
);
const progressTypeLabel = (type: EngineProgressInfo["type"]) => {
  return type === "download" ? "ダウンロード" : "インストール";
};
function installEngine(engineId: EngineId) {
  engineProgressInfo.value[engineId] = { progress: 0, type: "download" };
  void window.welcomeBackend
    .installEngine({
      engineId: engineId,
      // TODO: 選べるようにする
      target: "linux-x64-cpu",
    })
    .then(() => {
      console.log(`Engine package ${engineId} installation started.`);
    });
}

function launchMainWindow() {
  void window.welcomeBackend.launchMainWindow();
}

onMounted(() => {
  console.log("Welcome画面TODO");

  window.welcomeBackend.registerIpcHandler({
    updateEngineDownloadProgress: ({ engineId, progress, type }) => {
      engineProgressInfo.value[engineId] = { progress, type };
    },
  });

  void window.welcomeBackend
    .fetchLatestEnginePackageStatuses()
    .then((statuses) => {
      latestEngineInfos.value = statuses;
    });
});
</script>
