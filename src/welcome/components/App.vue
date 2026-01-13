<template>
  <ErrorBoundary>
    <TooltipProvider disableHoverableContent :delayDuration="500">
      <QLayout reveal container>
        <QHeader class="q-pa-sm">
          <QToolbar>
            <QToolbarTitle class="text-display"
              >エンジンのセットアップ</QToolbarTitle
            >
            <QSpace />

            <BaseTooltip
              :label="editorDisabledReason || ''"
              :disabled="editorDisabledReason == null"
            >
              <BaseButton
                label="エディタを起動"
                :disabled="editorDisabledReason != null"
                @click="switchToMainWindow"
              />
            </BaseTooltip>
          </QToolbar>
        </QHeader>

        <QPageContainer>
          <QPage class="welcome-page">
            <BaseScrollArea>
              <div class="inner">
                <BaseDocumentView class="welcome-intro">
                  VOICEVOXエディタを使用するには、音声合成エンジンのインストールが必要です。
                  以下のエンジン一覧から、インストールまたは更新を行ってください。
                </BaseDocumentView>

                <div v-if="onlineFetchErrorMessage" class="engine-error">
                  <div class="engine-error-text">
                    オンラインからエンジン情報を取得できませんでした。
                    ネットワークの状態を確認するか、再試行してください。
                    <p
                      v-if="onlineFetchErrorMessage"
                      class="engine-error-detail"
                    >
                      {{ onlineFetchErrorMessage }}
                    </p>
                  </div>
                  <div class="engine-error-actions">
                    <BaseButton
                      label="再試行"
                      variant="primary"
                      :disabled="
                        loadingEngineInfosState === 'loadingLocal' ||
                        loadingEngineInfosState === 'fetchingLatest'
                      "
                      @click="fetchInstalledEngineInfos"
                    />
                  </div>
                </div>

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
                    v-for="selectedEngine in engineInfosForDisplay"
                    :key="selectedEngine.package.engineId"
                  >
                    <div class="engine-card">
                      <div class="engine-card-head">
                        <div class="engine-name">
                          {{ selectedEngine.package.engineName }}
                        </div>
                        <span
                          class="status-pill"
                          :data-status="determineEngineStatus(selectedEngine)"
                        >
                          {{
                            statusLabel(determineEngineStatus(selectedEngine))
                          }}
                        </span>
                      </div>
                      <div class="engine-meta">
                        <div>
                          最新バージョン：
                          {{ latestVersionLabel(selectedEngine) }}
                        </div>
                        <div>
                          インストール済み：
                          {{
                            selectedEngine.localInfo.installed.status ===
                            "notInstalled"
                              ? "未インストール"
                              : selectedEngine.localInfo.installed
                                  .installedVersion
                          }}
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
                        <BaseSelect
                          :disabled="
                            isDownloadingOrInstalling(
                              selectedEngine.package.engineId,
                            )
                          "
                          :modelValue="getSelectedRuntimeTarget(selectedEngine)"
                          placeholder="ターゲットを選択"
                          @update:modelValue="
                            (value) =>
                              setSelectedRuntimeTarget(
                                selectedEngine.package.engineId,
                                value,
                              )
                          "
                        >
                          <BaseSelectItem
                            v-for="targetInfo in availableRuntimeTargets(
                              selectedEngine,
                            )"
                            :key="targetInfo.target"
                            :value="targetInfo.target"
                            :label="runtimeTargetLabel(targetInfo)"
                          />
                        </BaseSelect>
                        <BaseButton
                          :label="actionLabel(selectedEngine)"
                          :disabled="isActionDisabled(selectedEngine)"
                          :variant="
                            determineEngineStatus(selectedEngine) ===
                            'notInstalled'
                              ? 'primary'
                              : 'default'
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
import semver from "semver";
import { computed, onMounted, ref } from "vue";
import { TooltipProvider } from "reka-ui";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import {
  EnginePackageBase,
  EnginePackageLocalInfo,
  EnginePackageRemoteInfo,
} from "@/backend/electron/engineAndVvppController";
import { EngineId } from "@/type/preload";
import type { RuntimeTarget } from "@/domain/defaultEngine/latetDefaultEngine";
import { setThemeToCss } from "@/domain/dom";
import { themes } from "@/domain/theme";
import BaseButton from "@/components/Base/BaseButton.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import BaseDocumentView from "@/components/Base/BaseDocumentView.vue";
import BaseTooltip from "@/components/Base/BaseTooltip.vue";
import BaseSelect from "@/components/Base/BaseSelect.vue";
import BaseSelectItem from "@/components/Base/BaseSelectItem.vue";
import { ExhaustiveError, UnreachableError } from "@/type/utility";

type DisplayStatus = "notInstalled" | "installed" | "outdated" | "latest";

type DisplayEngineInfo = {
  package: EnginePackageBase;
  localInfo: EnginePackageLocalInfo;
  remoteInfo: EnginePackageRemoteInfo | undefined;
};

const localEngineInfos = ref<EnginePackageLocalInfo[] | undefined>(undefined);
const remoteEngineInfos = ref<EnginePackageRemoteInfo[] | undefined>(undefined);
const loadingEngineInfosState = ref<
  "uninitialized" | "loadingLocal" | "fetchingLatest" | "fetched"
>("uninitialized");
const onlineFetchErrorMessage = ref<string | null>(null);
const engineInfosForDisplay = computed<DisplayEngineInfo[]>(() => {
  const localInfos = localEngineInfos.value;
  if (!localInfos) {
    return [];
  }
  return localInfos.map((localInfo) => {
    const remoteInfo = remoteEngineInfos.value?.find(
      (remote) => remote.package.engineId === localInfo.package.engineId,
    );
    return {
      package: localInfo.package,
      localInfo,
      remoteInfo,
    };
  });
});
const runtimeTargetSelections = ref<
  Record<EngineId, RuntimeTarget | undefined>
>({});

const availableRuntimeTargets = (
  engineInfo: DisplayEngineInfo,
): EnginePackageRemoteInfo["availableRuntimeTargets"] => {
  return engineInfo.remoteInfo?.availableRuntimeTargets ?? [];
};

const getDefaultRuntimeTarget = (
  engineInfo: DisplayEngineInfo,
): RuntimeTarget | undefined => {
  const remoteInfo = engineInfo.remoteInfo;
  if (!remoteInfo) {
    return undefined;
  }
  if (
    remoteInfo.defaultRuntimeTarget &&
    remoteInfo.availableRuntimeTargets.some(
      (targetInfo) => targetInfo.target === remoteInfo.defaultRuntimeTarget,
    )
  ) {
    return remoteInfo.defaultRuntimeTarget;
  }
  return remoteInfo.availableRuntimeTargets[0]?.target;
};

const getSelectedRuntimeTarget = (
  engineInfo: DisplayEngineInfo,
): RuntimeTarget | undefined => {
  return (
    runtimeTargetSelections.value[engineInfo.package.engineId] ??
    getDefaultRuntimeTarget(engineInfo)
  );
};

const setSelectedRuntimeTarget = (
  engineId: EngineId,
  target: RuntimeTarget | undefined,
) => {
  if (!target) {
    throw new UnreachableError();
  }
  runtimeTargetSelections.value = {
    ...runtimeTargetSelections.value,
    [engineId]: target,
  };
};

const getPackageInfoForTarget = (
  engineInfo: DisplayEngineInfo,
  target: RuntimeTarget | undefined,
) => {
  if (!target) {
    return undefined;
  }
  return availableRuntimeTargets(engineInfo).find(
    (targetInfo) => targetInfo.target === target,
  )?.packageInfo;
};

const getSelectedPackageInfo = (engineInfo: DisplayEngineInfo) =>
  getPackageInfoForTarget(engineInfo, getSelectedRuntimeTarget(engineInfo));

const runtimeTargetLabel = (
  targetInfo:
    | EnginePackageRemoteInfo["availableRuntimeTargets"][number]
    | undefined,
) => {
  if (!targetInfo) {
    return "";
  }
  return targetInfo.packageInfo.label ?? targetInfo.target;
};
type EngineProgressInfo = {
  progress: number;
  type: "download" | "install";
};
const engineProgressInfo = ref<Record<EngineId, EngineProgressInfo>>(
  {} as Record<EngineId, EngineProgressInfo>,
);
const editorDisabledReason = computed<string | null>(() => {
  if (
    loadingEngineInfosState.value === "uninitialized" ||
    loadingEngineInfosState.value === "loadingLocal"
  ) {
    return "エンジン情報を読み込み中です。";
  }
  if (Object.keys(engineProgressInfo.value).length > 0) {
    return "エンジンのインストールまたは更新中です。";
  }
  const engineInfos = localEngineInfos.value ?? [];
  if (
    !engineInfos.some(
      (engineInfo) => engineInfo.installed.status !== "notInstalled",
    )
  ) {
    return "デフォルトエンジンがインストールされていません。";
  }

  return null;
});

const clearEngineProgress = (engineId: EngineId) => {
  const { [engineId]: _, ...rest } = engineProgressInfo.value;
  engineProgressInfo.value = rest as Record<EngineId, EngineProgressInfo>;
};

const progressTypeLabel = (type: EngineProgressInfo["type"]) => {
  return type === "download" ? "ダウンロード" : "インストール";
};

const determineEngineStatus = (
  engineInfo: DisplayEngineInfo,
): DisplayStatus => {
  if (engineInfo.localInfo.installed.status === "notInstalled") {
    return "notInstalled";
  }
  const packageInfo = getSelectedPackageInfo(engineInfo);
  if (!packageInfo) {
    return "installed";
  }
  return semver.lt(
    engineInfo.localInfo.installed.installedVersion,
    packageInfo.version,
  )
    ? "outdated"
    : "latest";
};

const latestVersionLabel = (engineInfo: DisplayEngineInfo) => {
  const packageInfo = getSelectedPackageInfo(engineInfo);
  if (!packageInfo) {
    return "（読み込み中）";
  }
  return packageInfo.version;
};

const statusLabel = (status: DisplayStatus) => {
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
      throw new ExhaustiveError(status);
  }
};

const getEngineProgress = (engineId: EngineId) =>
  engineProgressInfo.value[engineId];
const isDownloadingOrInstalling = (engineId: EngineId) => {
  const progress = getEngineProgress(engineId)?.progress;
  return progress != undefined && progress < 100;
};

const actionLabel = (engineInfo: DisplayEngineInfo) => {
  if (isDownloadingOrInstalling(engineInfo.package.engineId)) {
    return "処理中";
  }
  const engineStatus = determineEngineStatus(engineInfo);
  switch (engineStatus) {
    case "notInstalled":
      return "インストール";
    case "installed":
      return "インストール済み";
    case "outdated":
      return "更新";
    case "latest":
      return "再インストール";
    default:
      throw new ExhaustiveError(engineStatus);
  }
};

const isActionDisabled = (engineInfo: DisplayEngineInfo) => {
  if (!getSelectedRuntimeTarget(engineInfo)) {
    return true;
  }
  return isDownloadingOrInstalling(engineInfo.package.engineId);
};

const installEngine = async (engineId: EngineId) => {
  const engineInfo = engineInfosForDisplay.value.find(
    (info) => info.package.engineId === engineId,
  );
  const target = engineInfo ? getSelectedRuntimeTarget(engineInfo) : undefined;
  if (!target) {
    return;
  }
  engineProgressInfo.value[engineId] = { progress: 0, type: "download" };
  try {
    console.log(`Engine package ${engineId} installation started.`);
    await window.welcomeBackend.installEngine({
      engineId,
      target,
    });
    console.log(`Engine package ${engineId} installation completed.`);
  } catch (error) {
    window.welcomeBackend.logError(
      `Engine package ${engineId} installation failed`,
      error,
    );
  } finally {
    clearEngineProgress(engineId);
    void fetchInstalledEngineInfos();
  }
};

const switchToMainWindow = () => {
  if (editorDisabledReason.value) {
    return;
  }
  void window.welcomeBackend.launchMainWindow();
};

const fetchInstalledEngineInfos = async () => {
  onlineFetchErrorMessage.value = null;
  loadingEngineInfosState.value = "loadingLocal";
  localEngineInfos.value =
    await window.welcomeBackend.fetchEnginePackageLocalInfos();
  loadingEngineInfosState.value = "fetchingLatest";
  remoteEngineInfos.value = undefined;
  try {
    remoteEngineInfos.value =
      await window.welcomeBackend.fetchLatestEnginePackageRemoteInfos();
    onlineFetchErrorMessage.value = null;
  } catch (error) {
    onlineFetchErrorMessage.value =
      error instanceof Error
        ? error.message
        : "エンジン情報のオンライン取得に失敗しました。";
    window.welcomeBackend.logError(
      "エンジン情報のオンライン取得に失敗しました",
      error,
    );
  } finally {
    loadingEngineInfosState.value = "fetched";
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
@use "@/styles/colors" as colors_v1;

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

.engine-error {
  display: flex;
  flex-direction: column;
  gap: vars.$gap-1;
  padding: vars.$padding-2;
  border-radius: vars.$radius-2;
  border: 1px solid colors.$warning;
  background-color: colors.$background-alt;
  color: colors.$display-warning;
}

.engine-error-detail {
  display: block;
  font-size: 0.75rem;
  color: colors.$display-warning;
  margin-top: vars.$gap-1;
  word-break: break-word;
  white-space: pre-wrap;
}

.engine-error-actions {
  display: flex;
  justify-content: flex-end;
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
  color: colors.$display;
}

.engine-target-select {
  display: flex;
  flex-direction: column;
  gap: vars.$gap-1;
  width: 100%;
}

.engine-target-select-label {
  font-size: 0.75rem;
  color: colors.$display-sub;
  font-weight: 600;
}

.engine-target-select :deep(.SelectTrigger) {
  width: 100%;
}

.engine-progress {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: vars.$gap-1;
  color: colors.$display;
}

.engine-progress-bar {
  position: relative;
  height: 0.5em;
  border-radius: 999px;
  background-color: colors_v1.$surface;
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
  gap: vars.$gap-1;
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
</style>
