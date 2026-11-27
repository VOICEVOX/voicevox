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
import {
  assertNonNullable,
  ensureNotNullish,
  UnreachableError,
} from "@/type/utility";
import { showErrorDialog } from "@/components/Dialog/Dialog";
import { failure, success } from "@/type/result";

type LatestInfoState =
  | { type: "loading" }
  | {
      type: "fetched";
      info: EnginePackageLatestInfo;
      progress: EngineProgressInfo;
      selectedRuntimeTarget: RuntimeTarget;
    }
  | { type: "fetchError"; error: unknown };

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

type EngineProgressInfo =
  | {
      type: "idle";
    }
  | {
      progress: number;
      type: "download" | "install";
    };

type EngineState = {
  embeddedInfo: EnginePackageEmbeddedInfo;
  currentInfo: EnginePackageCurrentInfo;
  latestInfo: LatestInfoState;
};

export type LaunchEditorState =
  { enabled: true } | { enabled: false; reason: string };

function createWelcomeStore() {
  const automaticInstall = ref(false);
  const allEngineState = ref<AllEngineState>({
    type: "uninitialized",
  });

  const launchEditorState = computed<LaunchEditorState>(() => {
    if (automaticInstall.value)
      return { enabled: false, reason: "エンジンをインストール中です。" };
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
    progressInfo: EngineProgressInfo,
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

  const fetchEngineInfos = async () => {
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

    await Promise.all(
      engineIds.map(async (engineId) => {
        await fetchCurrentEngineInfo(engineId);
        await fetchEngineLatestInfo(engineId);
      }),
    );
  };

  const fetchCurrentEngineInfo = async (engineId: EngineId) => {
    if (allEngineState.value.type !== "loaded") {
      throw new UnreachableError();
    }
    const currentInfo =
      await window.welcomeBackend.getEnginePackageCurrentInfo(engineId);
    const engineState = allEngineState.value.engineStates[engineId];
    engineState.currentInfo = currentInfo;
  };

  const fetchEngineLatestInfo = async (engineId: EngineId) => {
    if (allEngineState.value.type !== "loaded") {
      throw new UnreachableError();
    }
    const engineState = allEngineState.value.engineStates[engineId];
    engineState.latestInfo = { type: "loading" };
    try {
      const info =
        await window.welcomeBackend.getEnginePackageLatestInfo(engineId);
      engineState.latestInfo = {
        type: "fetched",
        info,
        progress: { type: "idle" },
        selectedRuntimeTarget: getDefaultRuntimeTarget(engineId, info),
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

  const installEngine = async (
    engineId: EngineId,
  ): Promise<"succeeded" | "failed"> => {
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
    } catch (error) {
      window.welcomeBackend.logError(
        `Engine package ${engineId} installation failed`,
        error,
      );
      if (automaticInstall.value) throw error;
      await showErrorDialog("エンジンのインストールに失敗しました", error);
      return "failed";
    } finally {
      setEngineProgress(engineId, { type: "idle" });
      if (!automaticInstall.value) void fetchCurrentEngineInfo(engineId);
    }

    return "succeeded";
  };

  const switchToMainWindow = () => {
    if (!launchEditorState.value.enabled) {
      throw new UnreachableError();
    }
    void window.welcomeBackend.launchMainWindow();
  };

  /**
   * 条件に合う場合にエンジンを自動インストールしてメインウィンドウを起動する。
   * 条件は、エンジン未インストールで、候補が１つで、最新情報が取得できていること。
   */
  const autoInstallEngineAndLaunchMainWindow = async (
    target: RuntimeTarget,
  ) => {
    if (allEngineState.value.type !== "loaded") {
      throw new UnreachableError();
    }

    // 今のところはデフォルトエンジンが複数あることはないとする
    const allEngineStateLoaded = allEngineState.value;
    if (allEngineStateLoaded.engineIds.length !== 1) {
      throw new Error("Expected exactly one engine to be available");
    }

    const [engineId] = allEngineStateLoaded.engineIds;
    const state = allEngineState.value.engineStates[engineId];
    if (state.latestInfo.type === "fetchError") throw state.latestInfo.error;
    if (
      state.latestInfo.type !== "fetched" ||
      !state.latestInfo.info.availableRuntimeTargets.some(
        (info) => info.target === target,
      )
    )
      throw new Error(`Unsupported target: ${target}`);
    setSelectedRuntimeTarget(engineId, target);

    const engineState = allEngineStateLoaded.engineStates[engineId];
    if (engineState.latestInfo.type !== "fetched") {
      throw new Error(
        `Expected latest info to be fetched for engine ${engineId}`,
      );
    }

    const result = await installEngine(engineId);
    if (result !== "succeeded") {
      throw new Error(`Engine installation failed for engine ${engineId}`);
    }
  };

  const startup = async () => {
    window.welcomeBackend.registerIpcHandler({
      updateEngineDownloadProgress: ({ engineId, progress, type }) => {
        setEngineProgress(engineId, { progress, type });
      },
    });

    const { target } = await window.welcomeBackend.getStartupOptions();
    automaticInstall.value = target != undefined;
    void applyThemeFromConfig().then(() => {
      void window.welcomeBackend.displayReady();
    });

    if (!automaticInstall.value) {
      await fetchEngineInfos();
      return;
    }

    try {
      await fetchEngineInfos();
      await autoInstallEngineAndLaunchMainWindow(ensureNotNullish(target));
      await window.welcomeBackend.finishAutoInstall(success(undefined));
    } catch (error) {
      if (target == undefined) throw error;
      window.welcomeBackend.logError(error);
      await window.welcomeBackend.finishAutoInstall(failure(error as Error));
    }
  };

  return {
    automaticInstall,
    allEngineState,
    launchEditorState,
    setSelectedRuntimeTarget,
    getEngineState,
    fetchEngineLatestInfo,
    installEngine,
    switchToMainWindow,
    startup,
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
