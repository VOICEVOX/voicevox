import {
  EngineManifestActions,
  EngineManifestGetters,
  EngineManifestMutations,
  EngineManifestStoreState,
  VoiceVoxStoreOptions,
} from "@/store/type";

export const engineManifestStoreState: EngineManifestStoreState = {};

export const engineManifestStore: VoiceVoxStoreOptions<
  EngineManifestGetters,
  EngineManifestActions,
  EngineManifestMutations
> = {
  getters: {},
  mutations: {},
  actions: {
    GET_ENGINE_MANIFEST: async ({ dispatch }, { engineId }) => {
      return await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
        engineId,
      }).then((instance) =>
        instance.invoke("engineManifestEngineManifestGet")({})
      );
    },
  },
};
