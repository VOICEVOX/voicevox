<template>
  <ErrorBoundary>
    <TooltipProvider disableHoverableContent :delayDuration="500">
      <MenuBar />
      <QLayout reveal container>
        <WelcomeHeader
          :launchEditorDisabledReason
          @launchEditor="switchToMainWindow"
        />

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
                  <EngineCard
                    v-for="engine in engineInfosForDisplay"
                    :key="engine.package.engineId"
                    :engineName="engine.package.engineName"
                    :localInfo="engine.localInfo"
                    :remoteInfo="engine.remoteInfo"
                    :selectedRuntimeTarget="getSelectedRuntimeTarget(engine)"
                    :runtimeSelectDisabled="
                      isDownloadingOrInstalling(engine.package.engineId)
                    "
                    :progressInfo="getEngineProgress(engine.package.engineId)"
                    @selectRuntimeTarget="
                      (target) =>
                        setSelectedRuntimeTarget(
                          engine.package.engineId,
                          target,
                        )
                    "
                    @installEngine="
                      () => installEngine(engine.package.engineId)
                    "
                  />
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
import MenuBar from "./MenuBar.vue";
import WelcomeHeader from "./WelcomeHeader.vue";
import EngineCard from "./EngineCard.vue";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import type {
  EnginePackageBase,
  EnginePackageLocalInfo,
  EnginePackageRemoteInfo,
} from "@/backend/electron/engineAndVvppController";
import type { EngineId } from "@/type/preload";
import type { RuntimeTarget } from "@/domain/defaultEngine/latetDefaultEngine";
import { setThemeToCss } from "@/domain/dom";
import { themes } from "@/domain/theme";
import BaseButton from "@/components/Base/BaseButton.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import BaseDocumentView from "@/components/Base/BaseDocumentView.vue";
import { UnreachableError } from "@/type/utility";
import { showErrorDialog } from "@/components/Dialog/Dialog";

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

const getDefaultRuntimeTarget = (
  engineInfo: DisplayEngineInfo,
): RuntimeTarget | undefined => {
  const remoteInfo = engineInfo.remoteInfo;
  if (!remoteInfo) {
    return undefined;
  }
  return (
    remoteInfo.availableRuntimeTargets.find(
      (targetInfo) => targetInfo.packageInfo.displayInfo.default,
    ) || remoteInfo.availableRuntimeTargets[0]
  ).target;
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

type EngineProgressInfo = {
  progress: number;
  type: "download" | "install";
};
const engineProgressInfo = ref<Record<EngineId, EngineProgressInfo>>({});
const launchEditorDisabledReason = computed<string | null>(() => {
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
    return "エンジンがインストールされていません。";
  }

  return null;
});

const clearEngineProgress = (engineId: EngineId) => {
  const { [engineId]: _, ...rest } = engineProgressInfo.value;
  engineProgressInfo.value = rest;
};

const getEngineProgress = (engineId: EngineId) =>
  engineProgressInfo.value[engineId];
const isDownloadingOrInstalling = (engineId: EngineId) => {
  const progress = getEngineProgress(engineId)?.progress;
  return progress != undefined && progress < 100;
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
    await showErrorDialog("エンジンのインストールに失敗しました", error);
  } finally {
    clearEngineProgress(engineId);
    void fetchInstalledEngineInfos();
  }
};

const switchToMainWindow = () => {
  // NOTE: 処理漏れを防ぐために念のため例外を投げる
  if (launchEditorDisabledReason.value) {
    throw new UnreachableError();
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
    throw error;
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
