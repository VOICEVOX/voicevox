import { UserDictWord } from "@/openapi";
import {
  DictionaryGetters,
  DictionaryActions,
  DictionaryMutations,
  DictionaryStoreState,
  VoiceVoxStoreOptions,
} from "@/store/type";
import { toDispatchResponse } from "./audio";

export const dictionaryStoreState: DictionaryStoreState = {};

export const dictionaryStore: VoiceVoxStoreOptions<
  DictionaryGetters,
  DictionaryActions,
  DictionaryMutations
> = {
  getters: {},
  mutations: {},
  actions: {
    LOAD_USER_DICT: async ({ state, dispatch }) => {
      const engineInfo = state.engineInfos[0]; // TODO: 複数エンジン対応
      if (!engineInfo)
        throw new Error(`No such engineInfo registered: index == 0`);
      const engineDict = await dispatch("INVOKE_ENGINE_CONNECTOR", {
        engineKey: engineInfo.key,
        action: "getUserDictWordsUserDictGet",
        payload: [],
      }).then(toDispatchResponse("getUserDictWordsUserDictGet"));

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
      { surface, pronunciation, accentType }
    ) => {
      const engineInfo = state.engineInfos[0]; // TODO: 複数エンジン対応
      if (!engineInfo)
        throw new Error(`No such engineInfo registered: index == 0`);
      await dispatch("INVOKE_ENGINE_CONNECTOR", {
        engineKey: engineInfo.key,
        action: "addUserDictWordUserDictWordPost",
        payload: [
          {
            surface,
            pronunciation,
            accentType,
          },
        ],
      }).then(toDispatchResponse("addUserDictWordUserDictWordPost"));
    },

    REWIRTE_WORD: async (
      { state, dispatch },
      { wordUuid, surface, pronunciation, accentType }
    ) => {
      const engineInfo = state.engineInfos[0]; // TODO: 複数エンジン対応
      if (!engineInfo)
        throw new Error(`No such engineInfo registered: index == 0`);
      await dispatch("INVOKE_ENGINE_CONNECTOR", {
        engineKey: engineInfo.key,
        action: "rewriteUserDictWordUserDictWordWordUuidPut",
        payload: [
          {
            wordUuid,
            surface,
            pronunciation,
            accentType,
          },
        ],
      }).then(toDispatchResponse("rewriteUserDictWordUserDictWordWordUuidPut"));
    },

    DELETE_WORD: async ({ state, dispatch }, { wordUuid }) => {
      const engineInfo = state.engineInfos[0]; // TODO: 複数エンジン対応
      if (!engineInfo)
        throw new Error(`No such engineInfo registered: index == 0`);
      await dispatch("INVOKE_ENGINE_CONNECTOR", {
        engineKey: engineInfo.key,
        action: "deleteUserDictWordUserDictWordWordUuidDelete",
        payload: [
          {
            wordUuid,
          },
        ],
      }).then(
        toDispatchResponse("deleteUserDictWordUserDictWordWordUuidDelete")
      );
    },
  },
};
