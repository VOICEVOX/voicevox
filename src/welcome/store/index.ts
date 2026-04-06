import { computed, inject, provide, ref } from "vue";
import type { InjectionKey } from "vue";
import type {
  EnginePackageBase,
  EnginePackageCurrentInfo,
  EnginePackageLatestInfo,
} from "@/domain/enginePackage";
import type { RuntimeTarget } from "@/domain/defaultEngine/latestDefaultEngine";
import { setThemeToCss } from "@/domain/dom";
import { themes } from "@/domain/theme";
import type { EngineId } from "@/type/preload";
import {
  assertNonNullable,
  ExhaustiveError,
  UnreachableError,
} from "@/type/utility";
import { showErrorDialog } from "@/components/Dialog/Dialog";

export type LatestInfoState =
  | { type: "loading" }
  | { type: "fetched"; info: EnginePackageLatestInfo }
  | { type: "fetchError" };

export type DisplayEngineInfo = {
  package: EnginePackageBase;
  currentInfo: EnginePackageCurrentInfo;
  latestInfo: LatestInfoState;
};

export type LoadingEngineInfosState =
  | { type: "uninitialized" }
  | { type: "loadingCurrent" }
  | { type: "loaded"; engineInfos: DisplayEngineInfo[] };

export type EngineProgressInfo = {
  progress: number;
  type: "download" | "install";
};

export type LaunchEditorState =
  | { enabled: true }
  | { enabled: false; reason: string };

function createWelcomeStore() {
  const loadingEngineInfosState = ref<LoadingEngineInfosState>({
    type: "uninitialized",
  });
  const runtimeTargetSelections = ref<
    Record<EngineId, RuntimeTarget | undefined>
  >({});
  const engineProgressInfo = ref<Record<EngineId, EngineProgressInfo>>({});

  const launchEditorState = computed<LaunchEditorState>(() => {
    if (
      loadingEngineInfosState.value.type === "uninitialized" ||
      loadingEngineInfosState.value.type === "loadingCurrent"
    ) {
      return { enabled: false, reason: "エンジン情報を読み込み中です。" };
    }
    if (Object.keys(engineProgressInfo.value).length > 0) {
      return { enabled: false, reason: "エンジンをインストール中です。" };
    }
    if (loadingEngineInfosState.value.type !== "loaded") {
      throw new ExhaustiveError(loadingEngineInfosState.value);
    }
    if (
      !loadingEngineInfosState.value.engineInfos.some(
        ({ currentInfo }) => currentInfo.installed.status !== "notInstalled",
      )
    ) {
      return {
        enabled: false,
        reason: "エンジンがインストールされていません。",
      };
    }
    return { enabled: true };
  });

  const getDefaultRuntimeTarget = (
    engineInfo: DisplayEngineInfo,
  ): RuntimeTarget | undefined => {
    if (engineInfo.latestInfo.type !== "fetched") {
      return undefined;
    }
    const defaultRuntimeTargetInfo =
      engineInfo.latestInfo.info.availableRuntimeTargets.find(
        (targetInfo) => targetInfo.packageInfo.displayInfo.default,
      );
    assertNonNullable(
      defaultRuntimeTargetInfo,
      `Default runtime target not found: engineId=${engineInfo.package.engineId}`,
    );
    return defaultRuntimeTargetInfo.target;
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
    target: RuntimeTarget,
  ) => {
    runtimeTargetSelections.value = {
      ...runtimeTargetSelections.value,
      [engineId]: target,
    };
  };

  const getEngineProgress = (engineId: EngineId) =>
    engineProgressInfo.value[engineId];

  const clearEngineProgress = (engineId: EngineId) => {
    const { [engineId]: _, ...rest } = engineProgressInfo.value;
    engineProgressInfo.value = rest;
  };

  const updateLatestInfoState = (
    engineId: EngineId,
    latestInfo: LatestInfoState,
  ) => {
    if (loadingEngineInfosState.value.type !== "loaded") {
      return;
    }
    loadingEngineInfosState.value = {
      type: "loaded",
      engineInfos: loadingEngineInfosState.value.engineInfos.map(
        (engineInfo) =>
          engineInfo.package.engineId === engineId
            ? { ...engineInfo, latestInfo }
            : engineInfo,
      ),
    };
  };

  const fetchEngineRemoteInfo = async (engineId: EngineId) => {
    updateLatestInfoState(engineId, { type: "loading" });
    try {
      const info =
        await window.welcomeBackend.fetchEnginePackageRemoteInfo(engineId);
      updateLatestInfoState(engineId, { type: "fetched", info });
    } catch (error) {
      window.welcomeBackend.logWarn(
        `Engine package ${engineId} remote info fetch failed`,
        error,
      );
      updateLatestInfoState(engineId, { type: "fetchError" });
    }
  };

  const fetchInstalledEngineInfos = async () => {
    loadingEngineInfosState.value = { type: "loadingCurrent" };
    const currentEngineInfos =
      await window.welcomeBackend.fetchEnginePackageLocalInfos();
    loadingEngineInfosState.value = {
      type: "loaded",
      engineInfos: currentEngineInfos.map((currentInfo) => ({
        package: currentInfo.package,
        currentInfo,
        latestInfo: { type: "loading" },
      })),
    };
    await Promise.all(
      currentEngineInfos.map((currentInfo) =>
        fetchEngineRemoteInfo(currentInfo.package.engineId),
      ),
    );
  };

  const applyThemeFromConfig = async () => {
    const currentTheme = await window.welcomeBackend.getCurrentTheme();
    const theme = themes.find((value) => value.name === currentTheme);
    assertNonNullable(theme, `Theme not found: ${currentTheme}`);
    setThemeToCss(theme);
  };

  const installEngine = async (engineId: EngineId) => {
    if (loadingEngineInfosState.value.type !== "loaded") {
      throw new UnreachableError();
    }
    const engineInfo = loadingEngineInfosState.value.engineInfos.find(
      (info) => info.package.engineId === engineId,
    );
    assertNonNullable(engineInfo, `Engine info not found: engineId=${engineId}`);
    const target = getSelectedRuntimeTarget(engineInfo);
    assertNonNullable(
      target,
      `Runtime target not found: engineId=${engineInfo.package.engineId}`,
    );
    engineProgressInfo.value[engineId] = { progress: 0, type: "download" };
    try {
      console.log(`Engine package ${engineId} installation started.`);
      await window.welcomeBackend.installEngine({ engineId, target });
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
    if (!launchEditorState.value.enabled) {
      throw new UnreachableError();
    }
    void window.welcomeBackend.launchMainWindow();
  };

  const initialize = () => {
    window.welcomeBackend.registerIpcHandler({
      updateEngineDownloadProgress: ({ engineId, progress, type }) => {
        engineProgressInfo.value[engineId] = { progress, type };
      },
    });
    void fetchInstalledEngineInfos();
    void applyThemeFromConfig();
  };

  return {
    loadingEngineInfosState,
    launchEditorState,
    getSelectedRuntimeTarget,
    setSelectedRuntimeTarget,
    getEngineProgress,
    fetchEngineRemoteInfo,
    installEngine,
    switchToMainWindow,
    initialize,
  };
}

type WelcomeStore = ReturnType<typeof createWelcomeStore>;

const welcomeStoreKey: InjectionKey<WelcomeStore> = Symbol("welcomeStore");

export function provideWelcomeStore() {
  const store = createWelcomeStore();
  provide(welcomeStoreKey, store);
  return store;
}

export function useStore(): WelcomeStore {
  const store = inject(welcomeStoreKey);
  assertNonNullable(store, "WelcomeStore is not provided");
  return store;
}
