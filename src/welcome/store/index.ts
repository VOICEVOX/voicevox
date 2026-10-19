import { computed, inject, provide, ref } from "vue";
import type { InjectionKey } from "vue";
import type {
  EnginePackageEmbeddedInfo,
  EnginePackageCurrentInfo,
  EnginePackageLatestInfo,
} from "@/domain/enginePackage";
import type { RuntimeTarget } from "@/domain/defaultEngine/latestDefaultEngine";
import { setThemeToCss } from "@/domain/dom";
import { themes } from "@/domain/theme";
import type { EngineId } from "@/type/preload";
import { assertNonNullable, UnreachableError } from "@/type/utility";
import { showErrorDialog } from "@/components/Dialog/Dialog";

type LatestInfoState =
  | { type: "loading" }
  | { type: "fetchError"; error: unknown }
  | {
      type: "fetched";
      info: EnginePackageLatestInfo;
      selectedRuntimeTarget: RuntimeTarget;
      progress: EngineProgressInfo;
    };

type AllEngineState =
  | {
      type: "uninitialized";
    }
  | { type: "loading" }
  | {
      type: "loaded";
      engineIds: EngineId[];
      engineStates: Record<EngineId, EngineState>;
    };

type EngineInstallationProgress = {
  type: "download" | "install";
  progress: number;
};

type EngineProgressInfo = { type: "idle" } | EngineInstallationProgress;

type EngineState = {
  embeddedInfo: EnginePackageEmbeddedInfo;
  currentInfo: EnginePackageCurrentInfo;
  latestInfo: LatestInfoState;
};

export type LaunchEditorState =
  | { enabled: true }
  | { enabled: false; reason: string };

function createWelcomeStore() {
  const allEngineState = ref<AllEngineState>({
    type: "uninitialized",
  });

  const launchEditorState = computed<LaunchEditorState>(() => {
    if (
      allEngineState.value.type === "uninitialized" ||
      allEngineState.value.type === "loading"
    ) {
      return { enabled: false, reason: "エンジンの情報を読み込み中です。" };
    }
    const allEngineStateLoaded = allEngineState.value;
    if (
      allEngineState.value.engineIds.some((engineId) => {
        const latestInfo =
          allEngineStateLoaded.engineStates[engineId].latestInfo;
        return (
          latestInfo.type === "fetched" && latestInfo.progress.type !== "idle"
        );
      })
    ) {
      return { enabled: false, reason: "エンジンをインストール中です。" };
    }
    if (
      allEngineStateLoaded.engineIds.every((engineId) => {
        const currentInfo =
          allEngineStateLoaded.engineStates[engineId].currentInfo;
        return currentInfo.status === "notInstalled";
      })
    ) {
      return {
        enabled: false,
        reason: "エンジンがインストールされていません。",
      };
    }
    return { enabled: true };
  });

  const getDefaultRuntimeTarget = (
    engineId: EngineId,
    latestInfo: EnginePackageLatestInfo,
  ): RuntimeTarget => {
    const defaultRuntimeTargetInfo = latestInfo.availableRuntimeTargets.find(
      (targetInfo) => targetInfo.packageInfo.displayInfo.default,
    );
    assertNonNullable(
      defaultRuntimeTargetInfo,
      `Default runtime target not found: engineId=${engineId}`,
    );
    return defaultRuntimeTargetInfo.target;
  };

  const getSelectedRuntimeTarget = (engineId: EngineId): RuntimeTarget => {
    if (allEngineState.value.type !== "loaded") {
      throw new UnreachableError();
    }
    const engineState = allEngineState.value.engineStates[engineId];
    if (engineState.latestInfo.type !== "fetched") {
      throw new UnreachableError();
    }
    return engineState.latestInfo.selectedRuntimeTarget;
  };

  const setSelectedRuntimeTarget = (
    engineId: EngineId,
    target: RuntimeTarget,
  ) => {
    if (allEngineState.value.type !== "loaded") {
      throw new UnreachableError();
    }
    const engineState = allEngineState.value.engineStates[engineId];
    if (engineState.latestInfo.type !== "fetched") {
      throw new UnreachableError();
    }
    engineState.latestInfo.selectedRuntimeTarget = target;
  };

  const getEngineState = (engineId: EngineId) => {
    if (allEngineState.value.type !== "loaded") {
      throw new UnreachableError();
    }
    return allEngineState.value.engineStates[engineId];
  };

  const setEngineProgress = (
    engineId: EngineId,
    progressInfo: EngineInstallationProgress,
  ) => {
    if (allEngineState.value.type !== "loaded") {
      throw new UnreachableError();
    }
    const engineState = allEngineState.value.engineStates[engineId];
    if (engineState.latestInfo.type !== "fetched") {
      throw new UnreachableError();
    }
    engineState.latestInfo.progress = progressInfo;
  };

  const loadEngineEmbeddedInfos = async () => {
    allEngineState.value = { type: "loading" };

    const engineIds =
      await window.welcomeBackend.getDownloadableDefaultEnginePackageIds();
    const engineStates: Record<EngineId, EngineState> = {};
    await Promise.all(
      engineIds.map(async (engineId) => {
        const info =
          await window.welcomeBackend.getEnginePackageEmbeddedInfo(engineId);
        engineStates[engineId] = {
          embeddedInfo: info,
          currentInfo: { status: "notInstalled" },
          latestInfo: { type: "loading" },
        };
      }),
    );
    allEngineState.value = {
      type: "loaded",
      engineIds,
      engineStates,
    };

    for (const engineId of engineIds) {
      void fetchCurrentEngineInfo(engineId);
    }
  };

  const fetchCurrentEngineInfo = async (engineId: EngineId) => {
    if (allEngineState.value.type !== "loaded") {
      throw new UnreachableError();
    }
    const currentInfo =
      await window.welcomeBackend.getEnginePackageCurrentInfo(engineId);
    const engineState = allEngineState.value.engineStates[engineId];
    engineState.currentInfo = currentInfo;
    void fetchEngineLatestInfo(engineId);
  };

  const fetchEngineLatestInfo = async (engineId: EngineId) => {
    if (allEngineState.value.type !== "loaded") {
      throw new UnreachableError();
    }
    const engineState = allEngineState.value.engineStates[engineId];
    const previousLatestInfo = engineState.latestInfo;
    engineState.latestInfo = { type: "loading" };
    try {
      const info =
        await window.welcomeBackend.getEnginePackageLatestInfo(engineId);
      let selectedRuntimeTarget = getDefaultRuntimeTarget(engineId, info);
      if (previousLatestInfo.type === "fetched") {
        if (
          info.availableRuntimeTargets.some(
            (targetInfo) =>
              targetInfo.target === previousLatestInfo.selectedRuntimeTarget,
          )
        ) {
          selectedRuntimeTarget = previousLatestInfo.selectedRuntimeTarget;
        } else {
          window.welcomeBackend.logWarn(
            `Engine package ${engineId} selected runtime target is no longer available: ${previousLatestInfo.selectedRuntimeTarget}`,
          );
        }
      }
      engineState.latestInfo = {
        type: "fetched",
        info,
        progress: { type: "idle" },
        selectedRuntimeTarget,
      };
    } catch (error) {
      window.welcomeBackend.logWarn(
        `Engine package ${engineId} remote info fetch failed`,
        error,
      );
      engineState.latestInfo = {
        type: "fetchError",
        error,
      };
    }
  };

  const applyThemeFromConfig = async () => {
    const currentTheme = await window.welcomeBackend.getCurrentTheme();
    const theme = themes.find((value) => value.name === currentTheme);
    assertNonNullable(theme, `Theme not found: ${currentTheme}`);
    setThemeToCss(theme);
  };

  const installEngine = async (engineId: EngineId): Promise<boolean> => {
    const target = getSelectedRuntimeTarget(engineId);
    setEngineProgress(engineId, { type: "download", progress: 0 });
    try {
      window.welcomeBackend.logInfo(
        `Engine package ${engineId} installation started.`,
      );
      await window.welcomeBackend.installEngine({ engineId, target });
      window.welcomeBackend.logInfo(
        `Engine package ${engineId} installation completed.`,
      );
      return true;
    } catch (error) {
      window.welcomeBackend.logError(
        `Engine package ${engineId} installation failed`,
        error,
      );
      await showErrorDialog("エンジンのインストールに失敗しました", error);
      return false;
    } finally {
      void fetchCurrentEngineInfo(engineId);
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
        setEngineProgress(engineId, { progress, type });
      },
    });
    void loadEngineEmbeddedInfos();
    void applyThemeFromConfig();
  };

  return {
    allEngineState,
    launchEditorState,
    setSelectedRuntimeTarget,
    getEngineState,
    fetchEngineLatestInfo,
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
