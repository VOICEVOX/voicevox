<template>
  <ErrorBoundary>
    <TooltipProvider disableHoverableContent :delayDuration="500">
      <div class="welcome-frame">
        <QLayout reveal container class="welcome-layout">
          <QHeader class="welcome-header q-pa-sm">
            <QToolbar>
              <QToolbarTitle class="text-display">ようこそ</QToolbarTitle>
              <QSpace />
              <div class="welcome-actions">
                <BaseButton
                  label="エンジン情報を更新"
                  icon="refresh"
                  :disabled="isFetching"
                  @click="refreshLatestEngineInfos"
                />
                <BaseButton
                  label="メインウィンドウを起動"
                  variant="primary"
                  @click="launchMainWindow"
                />
              </div>
            </QToolbar>
          </QHeader>

          <QPageContainer>
            <QPage class="welcome-page">
              <BaseNavigationView>
                <template #sidebar>
                  <div class="list-header">
                    <div class="list-title">エンジン一覧</div>
                  </div>
                  <div v-if="latestEngineInfos" class="engine-list">
                    <BaseListItem
                      v-for="engineInfo in latestEngineInfos"
                      :key="engineInfo.package.engineId"
                      :selected="
                        selectedEngineId === engineInfo.package.engineId
                      "
                      @click="selectEngine(engineInfo.package.engineId)"
                    >
                      <div class="listitem-main">
                        <div class="listitem-title">
                          {{ engineInfo.package.engineName }}
                        </div>
                        <div class="listitem-sub">
                          <span
                            >最新: {{ engineInfo.package.latestVersion }}</span
                          >
                          <span>{{ installedLabel(engineInfo.installed) }}</span>
                        </div>
                        <div
                          v-if="getEngineProgress(engineInfo.package.engineId)"
                          class="listitem-progress"
                        >
                          {{
                            progressTypeLabel(
                              getEngineProgress(engineInfo.package.engineId)
                                .type,
                            )
                          }}
                          {{
                            Math.floor(
                              getEngineProgress(engineInfo.package.engineId)
                                .progress,
                            )
                          }}%
                        </div>
                      </div>
                      <div class="listitem-trailing">
                        <span
                          class="status-pill"
                          :data-status="engineInfo.installed.status"
                        >
                          {{ statusLabel(engineInfo.installed.status) }}
                        </span>
                      </div>
                    </BaseListItem>
                  </div>
                  <div v-else class="engine-loading">
                    <QSpinner color="primary" size="2rem" />
                    <div class="loading-text">
                      最新のエンジン情報を取得中...
                    </div>
                  </div>
                </template>

                <div class="detail">
                  <BaseScrollArea>
                    <div class="inner">
                      <BaseDocumentView class="welcome-intro">
                        <h1>VOICEVOXへようこそ</h1>
                        <p>
                          エンジンのインストールと更新をここから行えます。準備が整ったら、
                          メインウィンドウを起動して制作を始めましょう。
                        </p>
                      </BaseDocumentView>

                      <section v-if="selectedEngine" class="section">
                        <div class="section-title">選択中のエンジン</div>
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
                              {{ selectedEngine.package.latestVersion }}
                            </div>
                            <div>
                              {{ installedLabel(selectedEngine.installed) }}
                            </div>
                          </div>
                          <div
                            v-if="
                              getEngineProgress(
                                selectedEngine.package.engineId,
                              )
                            "
                            class="engine-progress"
                          >
                            <div class="engine-progress-label">
                              {{
                                progressTypeLabel(
                                  getEngineProgress(
                                    selectedEngine.package.engineId,
                                  ).type,
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
                                  getEngineProgress(
                                    selectedEngine.package.engineId,
                                  ).progress,
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
                                installEngine(
                                  selectedEngine.package.engineId,
                                )
                              "
                            />
                          </div>
                        </div>
                      </section>

                      <section v-else class="section empty-state">
                        <div class="empty-title">エンジン情報がありません</div>
                        <div class="empty-text">
                          右上の更新ボタンでエンジン情報を取得してください。
                        </div>
                      </section>
                    </div>
                  </BaseScrollArea>
                </div>
              </BaseNavigationView>
            </QPage>
          </QPageContainer>
        </QLayout>
      </div>
    </TooltipProvider>
  </ErrorBoundary>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { TooltipProvider } from "reka-ui";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import { EnginePackageStatus } from "@/backend/electron/engineAndVvppController";
import { EngineId } from "@/type/preload";
import { setThemeToCss } from "@/domain/dom";
import { themes } from "@/domain/theme";
import BaseButton from "@/components/Base/BaseButton.vue";
import BaseNavigationView from "@/components/Base/BaseNavigationView.vue";
import BaseListItem from "@/components/Base/BaseListItem.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import BaseDocumentView from "@/components/Base/BaseDocumentView.vue";

const latestEngineInfos = ref<EnginePackageStatus[] | undefined>(undefined);
const isFetching = ref(false);
const selectedEngineId = ref<EngineId | undefined>(undefined);

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
const statusLabel = (status: EnginePackageStatus["installed"]["status"]) => {
  switch (status) {
    case "notInstalled":
      return "未インストール";
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
const actionLabel = (engineInfo: EnginePackageStatus) => {
  if (isProgressing(engineInfo.package.engineId)) {
    return "処理中";
  }
  switch (engineInfo.installed.status) {
    case "notInstalled":
      return "インストール";
    case "outdated":
      return "更新";
    case "latest":
      return "最新";
    default:
      return "インストール";
  }
};
const isActionDisabled = (engineInfo: EnginePackageStatus) => {
  if (engineInfo.installed.status === "latest") {
    return true;
  }
  return isProgressing(engineInfo.package.engineId);
};
const selectedEngine = computed(() =>
  latestEngineInfos.value?.find(
    (engineInfo) => engineInfo.package.engineId === selectedEngineId.value,
  ),
);

const selectEngine = (engineId: EngineId) => {
  selectedEngineId.value = engineId;
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

const launchMainWindow = () => {
  void window.welcomeBackend.launchMainWindow();
};

const refreshLatestEngineInfos = async () => {
  isFetching.value = true;
  try {
    latestEngineInfos.value =
      await window.welcomeBackend.fetchLatestEnginePackageStatuses();
  } finally {
    isFetching.value = false;
  }
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

watch(
  latestEngineInfos,
  (infos) => {
    if (!infos || infos.length === 0) {
      selectedEngineId.value = undefined;
      return;
    }
    const exists = infos.some(
      (engineInfo) => engineInfo.package.engineId === selectedEngineId.value,
    );
    if (!exists) {
      selectedEngineId.value = infos[0].package.engineId;
    }
  },
  { immediate: true },
);

onMounted(() => {
  void applyThemeFromConfig();

  window.welcomeBackend.registerIpcHandler({
    updateEngineDownloadProgress: ({ engineId, progress, type }) => {
      engineProgressInfo.value[engineId] = { progress, type };
    },
  });

  void refreshLatestEngineInfos();
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/variables" as vars;

.welcome-frame {
  height: 100vh;
  padding: vars.$padding-2;
  background-color: colors.$background-alt;
}

.welcome-layout {
  height: 100%;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  border: 1px solid colors.$border;
  border-radius: vars.$radius-2;
  background-color: colors.$background;
  overflow: hidden;
}

.welcome-header {
  border-bottom: 1px solid colors.$border;
  background-color: colors.$background;
}

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
