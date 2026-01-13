<template>
  <ErrorBoundary>
    <TooltipProvider disableHoverableContent :delayDuration="500">
      <QLayout reveal container>
        <QHeader class="q-pa-sm">
          <QToolbar>
            <QToolbarTitle class="text-display">セットアップ</QToolbarTitle>
            <QSpace />
            <BaseButton
              label="エディタを起動"
              :disabled="!canLaunchEditor"
              @click="switchToMainWindow"
            />
          </QToolbar>
        </QHeader>

        <QPageContainer>
          <QPage class="welcome-page">
            <BaseScrollArea>
              <div class="inner">
                <BaseDocumentView class="welcome-intro">
                  <h1>エンジンのセットアップ</h1>
                  <p>
                    VOICEVOXエディタを使用するには、音声合成エンジンのインストールが必要です。
                    以下のエンジン一覧から、インストールまたは更新を行ってください。
                  </p>
                </BaseDocumentView>

                <div
                  v-if="
                    loadingEngineInfosState === 'uninitialized' ||
                    loadingEngineInfosState === 'loadingLocal'
                  "
                  class="engine-loading"
                >
                  <QSpinner color="primary" size="2.5rem" :thickness="5" />
                  <div class="loading-text">読み込み中...</div>
                </div>
                <template v-else>
                  <section
                    v-for="selectedEngine in latestEngineInfos ?? []"
                    :key="selectedEngine.package.engineId"
                  >
                    <div class="engine-card">
                      <div class="engine-card-head">
                        <div class="engine-name">
                          {{ selectedEngine.package.engineName }}
                        </div>
                        <span
                          class="status-pill"
                          :data-status="selectedEngine.installed.status"
                        >
                          {{ statusLabel(selectedEngine.installed.status) }}
                        </span>
                      </div>
                      <div class="engine-meta">
                        <div>
                          最新バージョン:
                          {{ latestVersionLabel(selectedEngine) }}
                        </div>
                        <div>
                          {{ installedLabel(selectedEngine.installed) }}
                        </div>
                      </div>
                      <div
                        v-if="
                          getEngineProgress(selectedEngine.package.engineId)
                        "
                        class="engine-progress"
                      >
                        <div class="engine-progress-label">
                          {{
                            progressTypeLabel(
                              getEngineProgress(selectedEngine.package.engineId)
                                .type,
                            )
                          }}
                        </div>
                        <div class="engine-progress-bar">
                          <div
                            class="engine-progress-fill"
                            :style="{
                              width: `${Math.floor(
                                getEngineProgress(
                                  selectedEngine.package.engineId,
                                ).progress,
                              )}%`,
                            }"
                          ></div>
                        </div>
                        <div class="engine-progress-value">
                          {{
                            Math.floor(
                              getEngineProgress(selectedEngine.package.engineId)
                                .progress,
                            )
                          }}%
                        </div>
                      </div>
                      <div class="engine-actions">
                        <BaseButton
                          :label="actionLabel(selectedEngine)"
                          :disabled="isActionDisabled(selectedEngine)"
                          :variant="
                            selectedEngine.installed.status === 'latest'
                              ? 'default'
                              : 'primary'
                          "
                          @click="
                            installEngine(selectedEngine.package.engineId)
                          "
                        />
                      </div>
                    </div>
                  </section>
                </template>
              </div>
            </BaseScrollArea>
          </QPage>
        </QPageContainer>
      </QLayout>
    </TooltipProvider>
  </ErrorBoundary>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { TooltipProvider } from "reka-ui";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import { EnginePackageStatus } from "@/backend/electron/engineAndVvppController";
import { EngineId } from "@/type/preload";
import { setThemeToCss } from "@/domain/dom";
import { themes } from "@/domain/theme";
import BaseButton from "@/components/Base/BaseButton.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import BaseDocumentView from "@/components/Base/BaseDocumentView.vue";

const latestEngineInfos = ref<EnginePackageStatus[] | undefined>(undefined);
const loadingEngineInfosState = ref<
  "uninitialized" | "loadingLocal" | "fetchingLatest" | "fetched"
>("uninitialized");
const canLaunchEditor = computed(() => {
  if (
    loadingEngineInfosState.value === "uninitialized" ||
    loadingEngineInfosState.value === "loadingLocal"
  ) {
    return false;
  }
  const engineInfos = latestEngineInfos.value ?? [];
  return engineInfos.some(
    (engineInfo) => engineInfo.installed.status !== "notInstalled",
  );
});

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
const latestVersionLabel = (engineInfo: EnginePackageStatus) => {
  return engineInfo.package.latestVersion ?? "（読み込み中）";
};
const statusLabel = (status: EnginePackageStatus["installed"]["status"]) => {
  switch (status) {
    case "notInstalled":
      return "未インストール";
    case "installed":
      return "インストール済み";
    case "outdated":
      return "更新あり";
    case "latest":
      return "最新";
    default:
      return "不明";
  }
};
const installedLabel = (installed: EnginePackageStatus["installed"]) => {
  if (installed.status === "notInstalled") {
    return "インストール済み: なし";
  }
  return `インストール済み: ${installed.installedVersion}`;
};
const getEngineProgress = (engineId: EngineId) =>
  engineProgressInfo.value[engineId];
const isProgressing = (engineId: EngineId) => {
  const progress = getEngineProgress(engineId)?.progress;
  return progress != undefined && progress < 100;
};
const hasLatestInfo = (engineInfo: EnginePackageStatus) => {
  return (
    engineInfo.package.packageInfo != undefined &&
    engineInfo.package.latestVersion != undefined
  );
};
const actionLabel = (engineInfo: EnginePackageStatus) => {
  if (isProgressing(engineInfo.package.engineId)) {
    return "処理中";
  }
  if (!hasLatestInfo(engineInfo)) {
    return engineInfo.installed.status === "notInstalled"
      ? "情報未取得"
      : "インストール済み";
  }
  switch (engineInfo.installed.status) {
    case "notInstalled":
      return "インストール";
    case "installed":
      return "インストール済み";
    case "outdated":
      return "更新";
    case "latest":
      return "最新";
    default:
      return "インストール";
  }
};
const isActionDisabled = (engineInfo: EnginePackageStatus) => {
  if (!hasLatestInfo(engineInfo)) {
    return true;
  }
  if (engineInfo.installed.status === "latest") {
    return true;
  }
  return isProgressing(engineInfo.package.engineId);
};

const installEngine = (engineId: EngineId) => {
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
};

const switchToMainWindow = () => {
  if (!canLaunchEditor.value) {
    return;
  }
  void window.welcomeBackend.launchMainWindow();
};

const fetchInstalledEngineInfos = async () => {
  loadingEngineInfosState.value = "loadingLocal";
  latestEngineInfos.value =
    await window.welcomeBackend.fetchEnginePackageInstallStatuses();
  loadingEngineInfosState.value = "fetchingLatest";
  latestEngineInfos.value =
    await window.welcomeBackend.fetchLatestEnginePackageStatuses();
  loadingEngineInfosState.value = "fetched";
};

const applyThemeFromConfig = async () => {
  try {
    const currentTheme = await window.welcomeBackend.getCurrentTheme();
    const theme =
      themes.find((value) => value.name === currentTheme) ?? themes[0];
    if (!theme) {
      return;
    }
    setThemeToCss(theme);
  } catch (error) {
    window.welcomeBackend.logError("テーマの適用に失敗しました", error);
  }
};

onMounted(() => {
  void applyThemeFromConfig();

  window.welcomeBackend.registerIpcHandler({
    updateEngineDownloadProgress: ({ engineId, progress, type }) => {
      engineProgressInfo.value[engineId] = { progress, type };
    },
  });

  void fetchInstalledEngineInfos();
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/variables" as vars;

.welcome-actions {
  display: flex;
  align-items: center;
  gap: vars.$gap-1;
  flex-wrap: wrap;
}

.welcome-page {
  padding: 0;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: vars.$padding-1 vars.$padding-2;
}

.list-title {
  @include mixin.headline-2;
}

.engine-list {
  display: flex;
  flex-direction: column;
  gap: vars.$gap-1;
  padding: 0 vars.$padding-1 vars.$padding-2;
}

.listitem-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.listitem-title {
  font-weight: 600;
}

.listitem-sub {
  display: flex;
  flex-wrap: wrap;
  gap: vars.$gap-1;
  font-size: 0.75rem;
  color: colors.$display-sub;
}

.listitem-progress {
  font-size: 0.7rem;
  color: colors.$display-sub;
}

.listitem-trailing {
  margin-left: auto;
  display: flex;
  align-items: center;
}

.status-pill {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  border: 1px solid colors.$border;
  background-color: colors.$control;
  color: colors.$display-sub;
}

.status-pill[data-status="latest"] {
  background-color: colors.$primary;
  color: colors.$display-oncolor;
  border-color: transparent;
}

.status-pill[data-status="outdated"] {
  background-color: colors.$warning;
  color: colors.$display-warning;
  border-color: colors.$display-warning;
}

.engine-loading {
  display: grid;
  place-items: center;
  gap: vars.$gap-1;
  padding: vars.$padding-2;
  color: colors.$display-sub;
}

.loading-text {
  font-size: 0.8rem;
}

.detail {
  height: 100%;
}

.inner {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding: vars.$padding-2;
  gap: vars.$gap-2;
}

.welcome-intro :deep(h1) {
  margin-bottom: vars.$gap-1;
}

.section {
  display: flex;
  flex-direction: column;
  gap: vars.$gap-1;
}

.section-title {
  @include mixin.headline-3;
}

.engine-card {
  display: flex;
  flex-direction: column;
  gap: vars.$gap-1;
  padding: vars.$padding-2;
  border-radius: vars.$radius-2;
  border: 1px solid colors.$border;
  background-color: colors.$surface;
}

.engine-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: vars.$gap-1;
}

.engine-name {
  font-weight: 700;
}

.engine-meta {
  display: grid;
  gap: 4px;
  font-size: 0.8rem;
  color: colors.$display-sub;
}

.engine-progress {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: vars.$gap-1;
  font-size: 0.7rem;
  color: colors.$display-sub;
}

.engine-progress-bar {
  position: relative;
  height: 6px;
  border-radius: 999px;
  background-color: colors.$control;
  overflow: hidden;
}

.engine-progress-fill {
  position: absolute;
  inset: 0;
  background-color: colors.$primary;
  transition: width 180ms ease;
}

.engine-actions {
  display: flex;
  justify-content: flex-end;
}

.empty-state {
  border: 1px solid colors.$border;
  border-radius: vars.$radius-2;
  padding: vars.$padding-2;
  color: colors.$display-sub;
  background-color: colors.$background-alt;
}

.empty-title {
  font-weight: 600;
}

@media (max-width: 900px) {
  .welcome-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
