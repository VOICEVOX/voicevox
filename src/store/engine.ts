import { EngineState, EngineStoreState, EngineStoreTypes } from "./type";
import { createUILockAction } from "./ui";
import { createPartialStore } from "./vuex";
import type { EngineManifest } from "@/openapi";
import type { EngineInfo } from "@/type/preload";

export const engineStoreState: EngineStoreState = {
  engineStates: {},
  engineCanUseGPU: {},

  // TODO:エンジン毎の設定が可能になれば消す
  allEngineCanUseGPU: false,
};

export const engineStore = createPartialStore<EngineStoreTypes>({
  GET_ENGINE_INFOS: {
    async action({ state, commit }) {
      const engineInfos = await window.electron.engineInfos();

      // セーフモード時はengineIdsをデフォルトエンジンのIDだけにする。
      let engineIds: string[];
      if (state.isSafeMode) {
        engineIds = engineInfos
          .filter((engineInfo) => engineInfo.type === "default")
          .map((info) => info.uuid);
      } else {
        engineIds = engineInfos.map((engineInfo) => engineInfo.uuid);
      }

      commit("SET_ENGINE_INFOS", {
        engineIds,
        engineInfos,
      });
    },
  },

  GET_SORTED_ENGINE_INFOS: {
    getter: (state) => {
      return Object.values(state.engineInfos).sort((a, b) => {
        const isDefaultA = a.type === "default" ? 1 : 0;
        const isDefaultB = b.type === "default" ? 1 : 0;
        if (isDefaultA !== isDefaultB) {
          return isDefaultB - isDefaultA;
        }

        return a.uuid.localeCompare(b.uuid);
      });
    },
  },
  SET_ENGINE_INFOS: {
    mutation(
      state,
      {
        engineIds,
        engineInfos,
      }: { engineIds: string[]; engineInfos: EngineInfo[] }
    ) {
      state.engineIds = engineIds;
      state.engineInfos = Object.fromEntries(
        engineInfos.map((engineInfo) => [engineInfo.uuid, engineInfo])
      );
      state.engineStates = Object.fromEntries(
        engineInfos.map((engineInfo) => [engineInfo.uuid, "STARTING"])
      );
    },
  },

  SET_ENGINE_MANIFESTS: {
    mutation(
      state,
      { engineManifests }: { engineManifests: Record<string, EngineManifest> }
    ) {
      state.engineManifests = engineManifests;
    },
  },

  FETCH_AND_SET_ENGINE_MANIFESTS: {
    async action({ state, commit }) {
      commit("SET_ENGINE_MANIFESTS", {
        engineManifests: Object.fromEntries(
          await Promise.all(
            state.engineIds.map(
              async (engineId) =>
                await this.dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
                  engineId,
                }).then(async (instance) => [
                  engineId,
                  await instance.invoke("engineManifestEngineManifestGet")({}),
                ])
            )
          )
        ),
      });
    },
  },

  IS_ALL_ENGINE_READY: {
    getter: (state, getters) => {
      // 1つもエンジンが登録されていない場合、準備完了していないことにする
      // レンダラープロセスがメインプロセスからエンジンリストを取得完了する前にレンダリングが行われるため、
      // IS_ALL_ENGINE_READYがエンジンリスト未初期化の状態で呼び出される可能性がある
      // この場合の意図しない挙動を抑制するためfalseを返す
      if (state.engineIds.length === 0) {
        return false;
      }

      for (const engineId of state.engineIds) {
        const isReady = getters.IS_ENGINE_READY(engineId);
        if (!isReady) return false;
      }
      return true; // state.engineStatesが空のときはtrue
    },
  },

  IS_ENGINE_READY: {
    getter: (state) => (engineId) => {
      const engineState: EngineState | undefined = state.engineStates[engineId];
      if (engineState === undefined)
        throw new Error(`No such engineState set: engineId == ${engineId}`);

      return engineState === "READY";
    },
  },

  START_WAITING_ENGINE: {
    action: createUILockAction(
      async ({ state, commit, dispatch }, { engineId }) => {
        let engineState: EngineState | undefined = state.engineStates[engineId];
        if (engineState === undefined)
          throw new Error(`No such engineState set: engineId == ${engineId}`);

        for (let i = 0; i < 100; i++) {
          engineState = state.engineStates[engineId]; // FIXME: explicit undefined
          if (engineState === undefined)
            throw new Error(`No such engineState set: engineId == ${engineId}`);

          if (engineState === "FAILED_STARTING") {
            break;
          }

          try {
            await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
              engineId,
            }).then((instance) => instance.invoke("versionVersionGet")({}));
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 1000));

            window.electron.logInfo(`Waiting engine ${engineId}`);
            continue;
          }
          engineState = "READY";
          commit("SET_ENGINE_STATE", { engineId, engineState });
          break;
        }

        if (engineState !== "READY") {
          commit("SET_ENGINE_STATE", {
            engineId,
            engineState: "FAILED_STARTING",
          });
        }
      }
    ),
  },

  RESTART_ENGINES: {
    async action({ dispatch, commit }, { engineIds }) {
      await Promise.all(
        engineIds.map(async (engineId) => {
          commit("SET_ENGINE_STATE", { engineId, engineState: "STARTING" });
          try {
            return window.electron.restartEngine(engineId);
          } catch (e) {
            dispatch("LOG_ERROR", {
              error: e,
              message: `Failed to restart engine: ${engineId}`,
            });
            await dispatch("DETECTED_ENGINE_ERROR", { engineId });
            return {
              success: false,
              anyNewCharacters: false,
            };
          }
        })
      );

      const result = await dispatch("POST_ENGINE_START", {
        engineIds,
      });

      return result;
    },
  },

  POST_ENGINE_START: {
    async action({ state, dispatch }, { engineIds }) {
      const result = await Promise.all(
        engineIds.map(async (engineId) => {
          if (state.engineStates[engineId] === "STARTING") {
            await dispatch("START_WAITING_ENGINE", { engineId });
            await dispatch("FETCH_AND_SET_ENGINE_MANIFEST", { engineId });
            await dispatch("LOAD_CHARACTER", { engineId });
          }

          await dispatch("LOAD_DEFAULT_STYLE_IDS");
          const newCharacters = await dispatch("GET_NEW_CHARACTERS");
          const result = {
            success: state.engineStates[engineId] === "READY",
            anyNewCharacters: newCharacters.length > 0,
          };
          return result;
        })
      );
      const mergedResult = {
        success: result.every((r) => r.success),
        anyNewCharacters: result.some((r) => r.anyNewCharacters),
      };
      if (mergedResult.anyNewCharacters) {
        dispatch("SET_DIALOG_OPEN", {
          isCharacterOrderDialogOpen: true,
        });
      }

      return mergedResult;
    },
  },

  DETECTED_ENGINE_ERROR: {
    action({ state, commit }, { engineId }) {
      const engineState: EngineState | undefined = state.engineStates[engineId];
      if (engineState === undefined)
        throw new Error(`No such engineState set: engineId == ${engineId}`);

      switch (engineState) {
        case "STARTING":
          commit("SET_ENGINE_STATE", {
            engineId,
            engineState: "FAILED_STARTING",
          });
          break;
        case "READY":
          commit("SET_ENGINE_STATE", { engineId, engineState: "ERROR" });
          break;
        default:
          commit("SET_ENGINE_STATE", { engineId, engineState: "ERROR" });
      }
    },
  },

  OPEN_ENGINE_DIRECTORY: {
    action(_, { engineId }) {
      return window.electron.openEngineDirectory(engineId);
    },
  },

  SET_ENGINE_STATE: {
    mutation(
      state,
      { engineId, engineState }: { engineId: string; engineState: EngineState }
    ) {
      state.engineStates[engineId] = engineState;
    },
  },

  IS_INITIALIZED_ENGINE_SPEAKER: {
    /**
     * 指定した話者（スタイルID）がエンジン側で初期化されているか
     */
    async action({ dispatch }, { engineId, styleId }) {
      // FIXME: なぜかbooleanではなくstringが返ってくる。
      // おそらくエンジン側のresponse_modelをBaseModel継承にしないといけない。
      const isInitialized: string = await dispatch(
        "INSTANTIATE_ENGINE_CONNECTOR",
        {
          engineId,
        }
      ).then(
        (instance) =>
          instance.invoke("isInitializedSpeakerIsInitializedSpeakerGet")({
            speaker: styleId,
          }) as unknown as string
      );
      if (isInitialized !== "true" && isInitialized !== "false")
        throw new Error(`Failed to get isInitialized.`);

      return isInitialized === "true";
    },
  },

  INITIALIZE_ENGINE_SPEAKER: {
    /**
     * 指定した話者（スタイルID）に対してエンジン側の初期化を行い、即座に音声合成ができるようにする。
     */
    async action({ dispatch }, { engineId, styleId }) {
      await dispatch("ASYNC_UI_LOCK", {
        callback: () =>
          dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
            engineId,
          }).then((instance) =>
            instance.invoke("initializeSpeakerInitializeSpeakerPost")({
              speaker: styleId,
            })
          ),
      });
    },
  },
  VALIDATE_ENGINE_DIR: {
    action: async (_, { engineDir }) => {
      return window.electron.validateEngineDir(engineDir);
    },
  },
  ADD_ENGINE_DIR: {
    action: async (_, { engineDir }) => {
      const engineDirs = await window.electron.getSetting("engineDirs");
      await window.electron.setSetting("engineDirs", [
        ...engineDirs,
        engineDir,
      ]);
    },
  },
  REMOVE_ENGINE_DIR: {
    action: async (_, { engineDir }) => {
      const engineDirs = await window.electron.getSetting("engineDirs");
      await window.electron.setSetting(
        "engineDirs",
        engineDirs.filter((path) => path !== engineDir)
      );
    },
  },
  INSTALL_VVPP_ENGINE: {
    action: async (_, path) => {
      return window.electron.installVvppEngine(path);
    },
  },
  UNINSTALL_VVPP_ENGINE: {
    action: async (_, engineId) => {
      return window.electron.uninstallVvppEngine(engineId);
    },
  },
  SET_ENGINE_MANIFEST: {
    mutation(
      state,
      {
        engineId,
        engineManifest,
      }: { engineId: string; engineManifest: EngineManifest }
    ) {
      state.engineManifests = {
        ...state.engineManifests,
        [engineId]: engineManifest,
      };
    },
  },

  FETCH_AND_SET_ENGINE_MANIFEST: {
    async action({ commit }, { engineId }) {
      commit("SET_ENGINE_MANIFEST", {
        engineId,
        engineManifest: await this.dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
          engineId,
        }).then((instance) =>
          instance.invoke("engineManifestEngineManifestGet")({})
        ),
      });
    },
  },

  SET_ENGINE_CAN_USE_GPU: {
    mutation(state, { engineId, engineCanUseGPU }) {
      state.engineCanUseGPU = {
        ...state.engineCanUseGPU,
        [engineId]: engineCanUseGPU,
      };
    },

    async action({ commit, dispatch }, { engineId }) {
      const canUseCudaOrDML = await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
        engineId,
      })
        .then(
          async (instance) =>
            await instance.invoke("supportedDevicesSupportedDevicesGet")({})
        )
        .catch((e) => e);

      const { cuda, dml } = canUseCudaOrDML;

      const canUseGPU = cuda || dml;

      commit("SET_ENGINE_CAN_USE_GPU", {
        engineId,
        engineCanUseGPU: canUseGPU,
      });
    },
  },

  // TODO:エンジン毎の設定が可能になれば消す
  SET_ALL_ENGINE_CAN_USE_GPU: {
    mutation(state, { allEngineCanUseGPU }) {
      state.allEngineCanUseGPU = allEngineCanUseGPU;
    },
    async action({ commit, dispatch, state }) {
      const engineInfos = await window.electron.engineInfos();

      const engineIds = engineInfos.map((engineInfo) => engineInfo.uuid);

      await Promise.all(
        engineIds.map((engineId) =>
          dispatch("SET_ENGINE_CAN_USE_GPU", { engineId })
        )
      );

      const allEngineCanUseGPU = Object.values(state.engineCanUseGPU).reduce(
        (prev, cur) => prev && cur,
        true
      );

      commit("SET_ALL_ENGINE_CAN_USE_GPU", {
        allEngineCanUseGPU,
      });
    },
  },
});
