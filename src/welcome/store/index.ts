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
import { errorToMessage } from "@/helpers/errorHelper";

type LatestInfoState =
  | { type: "loading" }
  | { type: "fetched"; info: EnginePackageLatestInfo }
  | { type: "fetchError"; message: string };

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

/**
 * TUnionの中のTTargetに当てはまるものにTAddedをマージした型を返す。
 *
 * これを他のファイルで使う場合は、この型を他のユーティリティ系のファイルに移動すること。
 *
 * @example
 * ```ts
 * type Hoge =
 *  | { type: "type1" }
 *  | { type: "type2"; field: string };
 *
 * type Result = MergeToTarget<
 *   Hoge,
 *   { type: "type2" },
 *   { newField: string }
 * >;
 *
 * // Resultは以下の型になる
 * type Result =
 *  | { type: "type1" }
 *  | { type: "type2"; field: string; newField: string }; // TAddedがマージされている
 * ```
 */
type MergeToTarget<TUnion, TTarget, TAdded> = TUnion extends TTarget
  ? TUnion & TAdded
  : TUnion;

export type EngineProgressInfo =
  | {
      type: "idle" | "unavailable";
    }
  | {
      progress: number;
      type: "download" | "install";
    };

type EngineState = {
  embeddedInfo: EnginePackageEmbeddedInfo;
  currentInfo: EnginePackageCurrentInfo;

  latestInfo: MergeToTarget<
    LatestInfoState,
    { type: "fetched" },
    {
      progress: EngineProgressInfo;
      selectedRuntimeTarget: RuntimeTarget;
    }
  >;
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

  const getEngineProgress = (engineId: EngineId): EngineProgressInfo => {
    if (allEngineState.value.type !== "loaded") {
      return { type: "unavailable" };
    }
    const engineState = allEngineState.value.engineStates[engineId];
    if (engineState.latestInfo.type !== "fetched") {
      return { type: "unavailable" };
    }
    return engineState.latestInfo.progress;
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
        message: errorToMessage(error).split("\n")[0],
      };
    }
  };

  const applyThemeFromConfig = async () => {
    const currentTheme = await window.welcomeBackend.getCurrentTheme();
    const theme = themes.find((value) => value.name === currentTheme);
    assertNonNullable(theme, `Theme not found: ${currentTheme}`);
    setThemeToCss(theme);
  };

  const installEngine = async (engineId: EngineId) => {
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
      await showErrorDialog("エンジンのインストールに失敗しました", error);
    } finally {
      setEngineProgress(engineId, { type: "idle" });
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
    getSelectedRuntimeTarget,
    setSelectedRuntimeTarget,
    getEngineState,
    getEngineProgress,
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
