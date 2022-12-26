import { EngineState, EngineStoreState, EngineStoreTypes } from "./type";
import { createUILockAction } from "./ui";
import { createPartialStore } from "./vuex";
import type { EngineManifest } from "@/openapi";
import type { EngineInfo } from "@/type/preload";

export const engineStoreState: EngineStoreState = {
  engineStates: {},
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

  RESTART_ENGINE_ALL: {
    async action({ state, dispatch }, { preventOpeningDialog }) {
      // NOTE: 暫定実装、すべてのエンジンの再起動に成功した場合に、成功とみなす
      const engineIds = state.engineIds;

      const promises = engineIds.map((engineId) =>
        dispatch("RESTART_ENGINE", {
          engineId,
        })
      );

      const result = await Promise.all(promises).then((results) => ({
        success: results.every((r) => r.success),
        anyNewCharacters: results.some((r) => r.anyNewCharacters),
      }));
      if (!preventOpeningDialog && result.anyNewCharacters) {
        dispatch("SET_DIALOG_OPEN", {
          isCharacterOrderDialogOpen: true,
        });
      }

      return result;
    },
  },

  RESTART_ENGINE: {
    async action(
      { dispatch, commit, state },
      { engineId, preventOpeningDialog }
    ) {
      commit("SET_ENGINE_STATE", { engineId, engineState: "STARTING" });
      const result = await window.electron
        .restartEngine(engineId)
        .then(async () => {
          await dispatch("START_WAITING_ENGINE", { engineId });
          await dispatch("FETCH_AND_SET_ENGINE_MANIFEST", { engineId });
          await dispatch("LOAD_CHARACTER", { engineId });

          const newCharacters = await dispatch("GET_NEW_CHARACTERS");
          return {
            success: state.engineStates[engineId] === "READY",
            anyNewCharacters: newCharacters.length > 0,
          };
        })
        .catch(async () => {
          await dispatch("DETECTED_ENGINE_ERROR", { engineId });
          return {
            success: false,
            anyNewCharacters: false,
          };
        });
      if (!preventOpeningDialog && result.anyNewCharacters) {
        dispatch("SET_DIALOG_OPEN", {
          isCharacterOrderDialogOpen: true,
        });
      }
      return result;
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
});
