import { EngineState, EngineStoreState, EngineStoreTypes } from "./type";
import { createUILockAction } from "./ui";
import { createPartialStore } from "./vuex";
import { createLogger } from "@/helpers/log";
import type { EngineManifest } from "@/openapi";
import type { EngineId, EngineInfo } from "@/type/preload";

export const engineStoreState: EngineStoreState = {
  engineStates: {},
  engineSupportedDevices: {},
  altPortInfos: {},
};
const { info, error } = createLogger("store/engine");

export const engineStore = createPartialStore<EngineStoreTypes>({
  /**
   * backendのエンジン情報をstateに同期して初期化する。
   * エンジンIDも同期する。
   */
  PULL_AND_INIT_ENGINE_INFOS: {
    async action({ state, mutations }) {
      let engineInfos = await window.backend.engineInfos();

      // マルチエンジンオフモード時はデフォルトエンジンだけにする。
      if (state.isMultiEngineOffMode) {
        engineInfos = engineInfos.filter((engineInfo) => engineInfo.isDefault);
      }
      const engineIds = engineInfos.map((engineInfo) => engineInfo.uuid);

      mutations.SET_ENGINE_INFOS({
        engineIds,
        engineInfos,
      });
    },
  },

  SET_ENGINE_INFO: {
    mutation(state, { engineId, engineInfo }) {
      state.engineInfos[engineId] = engineInfo;
    },
  },

  /** backendのエンジン情報をstateに同期する。 */
  PULL_ENGINE_INFOS: {
    async action({ mutations }, { engineIds }) {
      const engineInfos = await window.backend.engineInfos();
      for (const engineInfo of engineInfos) {
        if (engineIds.includes(engineInfo.uuid)) {
          mutations.SET_ENGINE_INFO({
            engineId: engineInfo.uuid,
            engineInfo,
          });
        }
      }
    },
  },

  GET_SORTED_ENGINE_INFOS: {
    getter: (state) => {
      return Object.values(state.engineInfos).sort((a, b) => {
        const isDefaultA = a.isDefault ? 1 : 0;
        const isDefaultB = b.isDefault ? 1 : 0;
        if (isDefaultA !== isDefaultB) {
          return isDefaultB - isDefaultA;
        }

        return a.uuid.localeCompare(b.uuid);
      });
    },
  },

  PULL_ALT_PORT_INFOS: {
    async action({ mutations }) {
      const altPortInfos = await window.backend.getAltPortInfos();
      mutations.SET_ALT_PORT_INFOS({ altPortInfos });
      return altPortInfos;
    },
  },

  SET_ALT_PORT_INFOS: {
    mutation(state, { altPortInfos }) {
      state.altPortInfos = altPortInfos;
    },
  },

  SET_ENGINE_INFOS: {
    mutation(
      state,
      {
        engineIds,
        engineInfos,
      }: { engineIds: EngineId[]; engineInfos: EngineInfo[] },
    ) {
      state.engineIds = engineIds;
      state.engineInfos = Object.fromEntries(
        engineInfos.map((engineInfo) => [engineInfo.uuid, engineInfo]),
      );
      state.engineStates = Object.fromEntries(
        engineInfos.map((engineInfo) => [engineInfo.uuid, "STARTING"]),
      );
    },
  },

  SET_ENGINE_MANIFESTS: {
    mutation(
      state,
      {
        engineManifests,
      }: { engineManifests: Record<EngineId, EngineManifest> },
    ) {
      state.engineManifests = engineManifests;
    },
  },

  FETCH_AND_SET_ENGINE_MANIFESTS: {
    async action({ state, mutations, actions }) {
      mutations.SET_ENGINE_MANIFESTS({
        engineManifests: Object.fromEntries<EngineManifest>(
          await Promise.all(
            state.engineIds.map(
              async (engineId) =>
                await actions
                  .INSTANTIATE_ENGINE_CONNECTOR({
                    engineId,
                  })
                  .then(
                    async (instance) =>
                      [
                        engineId,
                        await instance.invoke(
                          "engineManifestEngineManifestGet",
                        )({}),
                      ] as const,
                  ),
            ),
          ),
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
      if (engineState == undefined)
        throw new Error(`No such engineState set: engineId == ${engineId}`);

      return engineState === "READY";
    },
  },

  START_WAITING_ENGINE: {
    action: createUILockAction(
      async ({ state, mutations, actions }, { engineId }) => {
        let engineState: EngineState | undefined = state.engineStates[engineId];
        if (engineState == undefined)
          throw new Error(`No such engineState set: engineId == ${engineId}`);

        for (let i = 0; i < 100; i++) {
          engineState = state.engineStates[engineId]; // FIXME: explicit undefined
          if (engineState == undefined)
            throw new Error(`No such engineState set: engineId == ${engineId}`);

          if (engineState === "FAILED_STARTING") {
            break;
          }

          try {
            await actions
              .INSTANTIATE_ENGINE_CONNECTOR({
                engineId,
              })
              .then((instance) => instance.invoke("versionVersionGet")({}));
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 1000));

            info(`Waiting engine ${engineId}`);
            continue;
          }
          engineState = "READY";
          mutations.SET_ENGINE_STATE({ engineId, engineState });
          break;
        }

        if (engineState !== "READY") {
          mutations.SET_ENGINE_STATE({
            engineId,
            engineState: "FAILED_STARTING",
          });
        }
      },
    ),
  },

  RESTART_ENGINES: {
    async action({ actions, mutations }, { engineIds }) {
      await Promise.all(
        engineIds.map(async (engineId) => {
          mutations.SET_ENGINE_STATE({ engineId, engineState: "STARTING" });
          try {
            return window.backend.restartEngine(engineId);
          } catch (e) {
            error(`Failed to restart engine: ${engineId}`);
            await actions.DETECTED_ENGINE_ERROR({ engineId });
            return {
              success: false,
              anyNewCharacters: false,
            };
          }
        }),
      );

      await actions.PULL_ENGINE_INFOS({ engineIds });

      const result = await actions.POST_ENGINE_START({
        engineIds,
      });

      return result;
    },
  },

  POST_ENGINE_START: {
    async action({ state, actions }, { engineIds }) {
      await actions.PULL_ALT_PORT_INFOS();
      const result = await Promise.all(
        engineIds.map(async (engineId) => {
          if (state.engineStates[engineId] === "STARTING") {
            await actions.START_WAITING_ENGINE({ engineId });
            await actions.FETCH_AND_SET_ENGINE_MANIFEST({ engineId });
            await actions.FETCH_AND_SET_ENGINE_SUPPORTED_DEVICES({
              engineId,
            });
            await actions.LOAD_CHARACTER({ engineId });
          }

          await actions.LOAD_DEFAULT_STYLE_IDS();
          await actions.CREATE_ALL_DEFAULT_PRESET();
          const newCharacters = await actions.GET_NEW_CHARACTERS();
          const result = {
            success: state.engineStates[engineId] === "READY",
            anyNewCharacters: newCharacters.length > 0,
          };
          return result;
        }),
      );
      const mergedResult = {
        success: result.every((r) => r.success),
        anyNewCharacters: result.some((r) => r.anyNewCharacters),
      };
      if (mergedResult.anyNewCharacters) {
        void actions.SET_DIALOG_OPEN({
          isCharacterOrderDialogOpen: true,
        });
      }

      return mergedResult;
    },
  },

  DETECTED_ENGINE_ERROR: {
    action({ state, mutations }, { engineId }) {
      const engineState: EngineState | undefined = state.engineStates[engineId];
      if (engineState == undefined)
        throw new Error(`No such engineState set: engineId == ${engineId}`);

      switch (engineState) {
        case "STARTING":
          mutations.SET_ENGINE_STATE({
            engineId,
            engineState: "FAILED_STARTING",
          });
          break;
        case "READY":
          mutations.SET_ENGINE_STATE({ engineId, engineState: "ERROR" });
          break;
        default:
          mutations.SET_ENGINE_STATE({ engineId, engineState: "ERROR" });
      }
    },
  },

  OPEN_ENGINE_DIRECTORY: {
    action(_, { engineId }) {
      return window.backend.openEngineDirectory(engineId);
    },
  },

  SET_ENGINE_STATE: {
    mutation(
      state,
      {
        engineId,
        engineState,
      }: { engineId: EngineId; engineState: EngineState },
    ) {
      state.engineStates[engineId] = engineState;
    },
  },

  IS_INITIALIZED_ENGINE_SPEAKER: {
    /**
     * 指定した話者（スタイルID）がエンジン側で初期化されているか
     */
    async action({ actions }, { engineId, styleId }) {
      const isInitialized = await actions
        .INSTANTIATE_ENGINE_CONNECTOR({
          engineId,
        })
        .then((instance) =>
          instance.invoke("isInitializedSpeakerIsInitializedSpeakerGet")({
            speaker: styleId,
          }),
        );

      return isInitialized;
    },
  },

  INITIALIZE_ENGINE_CHARACTER: {
    /**
     * 指定したキャラクター（スタイルID）に対してエンジン側の初期化を行い、即座に音声合成ができるようにする。
     */
    async action({ actions }, { engineId, styleId, uiLock }) {
      const requestEngineToInitializeCharacter = () =>
        actions
          .INSTANTIATE_ENGINE_CONNECTOR({
            engineId,
          })
          .then((instance) =>
            instance.invoke("initializeSpeakerInitializeSpeakerPost")({
              speaker: styleId,
            }),
          );

      if (uiLock) {
        await actions.ASYNC_UI_LOCK({
          callback: requestEngineToInitializeCharacter,
        });
      } else {
        await requestEngineToInitializeCharacter();
      }
    },
  },

  VALIDATE_ENGINE_DIR: {
    action: async (_, { engineDir }) => {
      return window.backend.validateEngineDir(engineDir);
    },
  },

  ADD_ENGINE_DIR: {
    action: async (_, { engineDir }) => {
      const registeredEngineDirs = await window.backend.getSetting(
        "registeredEngineDirs",
      );
      await window.backend.setSetting("registeredEngineDirs", [
        ...registeredEngineDirs,
        engineDir,
      ]);
    },
  },

  REMOVE_ENGINE_DIR: {
    action: async (_, { engineDir }) => {
      const registeredEngineDirs = await window.backend.getSetting(
        "registeredEngineDirs",
      );
      await window.backend.setSetting(
        "registeredEngineDirs",
        registeredEngineDirs.filter((path) => path !== engineDir),
      );
    },
  },

  INSTALL_VVPP_ENGINE: {
    action: async (_, path) => {
      return window.backend.installVvppEngine(path);
    },
  },

  UNINSTALL_VVPP_ENGINE: {
    action: async (_, engineId) => {
      return window.backend.uninstallVvppEngine(engineId);
    },
  },

  SET_ENGINE_MANIFEST: {
    mutation(
      state,
      {
        engineId,
        engineManifest,
      }: { engineId: EngineId; engineManifest: EngineManifest },
    ) {
      state.engineManifests = {
        ...state.engineManifests,
        [engineId]: engineManifest,
      };
    },
  },

  FETCH_AND_SET_ENGINE_MANIFEST: {
    async action({ mutations }, { engineId }) {
      mutations.SET_ENGINE_MANIFEST({
        engineId,
        engineManifest: await this.actions
          .INSTANTIATE_ENGINE_CONNECTOR({
            engineId,
          })
          .then((instance) =>
            instance.invoke("engineManifestEngineManifestGet")({}),
          ),
      });
    },
  },

  SET_ENGINE_SUPPORTED_DEVICES: {
    mutation(state, { engineId, supportedDevices }) {
      state.engineSupportedDevices = {
        ...state.engineSupportedDevices,
        [engineId]: supportedDevices,
      };
    },
  },

  FETCH_AND_SET_ENGINE_SUPPORTED_DEVICES: {
    async action({ actions, mutations }, { engineId }) {
      const supportedDevices = await actions
        .INSTANTIATE_ENGINE_CONNECTOR({
          engineId,
        })
        .then(
          async (instance) =>
            await instance.invoke("supportedDevicesSupportedDevicesGet")({}),
        );

      mutations.SET_ENGINE_SUPPORTED_DEVICES({
        engineId,
        supportedDevices: supportedDevices,
      });
    },
  },

  ENGINE_CAN_USE_GPU: {
    getter: (state) => (engineId) => {
      const supportedDevices = state.engineSupportedDevices[engineId];

      return supportedDevices?.cuda || supportedDevices?.dml;
    },
  },
});
