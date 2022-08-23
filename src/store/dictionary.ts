import { UserDictWord } from "@/openapi";
import {
  DictionaryGetters,
  DictionaryActions,
  DictionaryMutations,
  DictionaryStoreState,
  VoiceVoxStoreOptions,
} from "@/store/type";

export const dictionaryStoreState: DictionaryStoreState = {};

export const dictionaryStore: VoiceVoxStoreOptions<
  DictionaryGetters,
  DictionaryActions,
  DictionaryMutations
> = {
  getters: {},
  mutations: {},
  actions: {
    LOAD_USER_DICT: async ({ dispatch }, { engineId }) => {
      const engineDict = await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
        engineId,
      }).then((instance) => instance.invoke("getUserDictWordsUserDictGet")({}));

      // 50音順にソートするために、一旦arrayにする
      const dictArray = Object.keys(engineDict).map((k) => {
        return { key: k, ...engineDict[k] };
      });
      dictArray.sort((a, b) => {
        if (a.yomi > b.yomi) {
          return 1;
        } else {
          return -1;
        }
      });
      const dictEntries: [string, UserDictWord][] = dictArray.map((v) => {
        const { key, ...newV } = v;
        return [key, newV];
      });
      return Object.fromEntries(dictEntries);
    },

    ADD_WORD: async (
      { state, dispatch },
      { surface, pronunciation, accentType, priority }
    ) => {
      const engineId: string | undefined = state.engineIds[0]; // TODO: 複数エンジン対応
      if (engineId === undefined)
        throw new Error(`No such engine registered: index == 0`);
      await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
        engineId,
      }).then((instance) =>
        instance.invoke("addUserDictWordUserDictWordPost")({
          surface,
          pronunciation,
          accentType,
          priority,
        })
      );
    },

    REWRITE_WORD: async (
      { state, dispatch },
      { wordUuid, surface, pronunciation, accentType, priority }
    ) => {
      const engineId: string | undefined = state.engineIds[0]; // TODO: 複数エンジン対応
      if (engineId === undefined)
        throw new Error(`No such engine registered: index == 0`);
      await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
        engineId,
      }).then((instance) =>
        instance.invoke("rewriteUserDictWordUserDictWordWordUuidPut")({
          wordUuid,
          surface,
          pronunciation,
          accentType,
          priority,
        })
      );
    },

    DELETE_WORD: async ({ state, dispatch }, { wordUuid }) => {
      const engineId: string | undefined = state.engineIds[0]; // TODO: 複数エンジン対応
      if (engineId === undefined)
        throw new Error(`No such engine registered: index == 0`);
      await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
        engineId,
      }).then((instance) =>
        instance.invoke("deleteUserDictWordUserDictWordWordUuidDelete")({
          wordUuid,
        })
      );
    },
  },
};
