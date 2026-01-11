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
          </div>
        </div>
        <div v-else>最新のエンジン情報を取得中...</div>
      </div>
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
function installEngine(engineId: EngineId) {
  void window.welcomeBackend
    .installEngine({
      engineId: engineId,
      target: "linux-x64-cpu",
    })
    .then(() => {
      console.log(`Engine package ${engineId} installation started.`);
    });
}

onMounted(() => {
  console.log("Welcome画面TODO");

  void window.welcomeBackend
    .fetchLatestEnginePackageStatuses()
    .then((statuses) => {
      latestEngineInfos.value = statuses;
    });
});
</script>
