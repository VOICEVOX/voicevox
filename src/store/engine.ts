import { EngineState, EngineStoreState, EngineStoreTypes } from "./type";
import { createUILockAction } from "./ui";
import { createPartialStore } from "./vuex";
import type { EngineManifest } from "@/openapi";
import type { EngineInfo } from "@/type/preload";

export const engineStoreState: EngineStoreState = {
  engineStates: {},
};

export const engineStore = createPartialStore<EngineStoreTypes>({
  IS_ALL_ENGINE_READY: {
    getter: (state, getters) => {
      // NOTE: 1つもエンジンが登録されていない場合、準備完了していないことにする
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
    async action({ state, dispatch }) {
      // NOTE: 暫定実装、すべてのエンジンの再起動に成功した場合に、成功とみなす
      let allSuccess = true;
      const engineIds = state.engineIds;

      for (const engineId of engineIds) {
        const success = await dispatch("RESTART_ENGINE", {
          engineId,
        });
        allSuccess = allSuccess && success;
      }

      return allSuccess;
    },
  },

  RESTART_ENGINE: {
    async action({ dispatch, commit, state }, { engineId }) {
      commit("SET_ENGINE_STATE", { engineId, engineState: "STARTING" });
      const success = await window.electron
        .restartEngine(engineId)
        .then(async () => {
          await dispatch("START_WAITING_ENGINE", { engineId });
          return state.engineStates[engineId] === "READY";
        })
        .catch(async () => {
          await dispatch("DETECTED_ENGINE_ERROR", { engineId });
          return false;
        });
      return success;
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

  OPEN_USER_ENGINE_DIRECTORY: {
    action() {
      return window.electron.openUserEngineDirectory();
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

  GET_ENGINE_INFOS: {
    async action({ commit }) {
      commit("SET_ENGINE_INFOS", {
        engineInfos: await window.electron.engineInfos(),
      });
    },
  },

  SET_ENGINE_INFOS: {
    mutation(state, { engineInfos }: { engineInfos: EngineInfo[] }) {
      state.engineIds = engineInfos.map((engineInfo) => engineInfo.uuid);
      state.engineInfos = Object.fromEntries(
        engineInfos.map((engineInfo) => [engineInfo.uuid, engineInfo])
      );
      state.engineStates = Object.fromEntries(
        engineInfos.map((engineInfo) => [engineInfo.uuid, "STARTING"])
      );
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
