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
      const engineKey = state.engineKeys[0]; // TODO: 複数エンジン対応
      if (!engineKey) throw new Error(`No such engine registered: index == 0`);
      const engineDict = await dispatch("INVOKE_ENGINE_CONNECTOR", {
        engineKey,
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
      const engineKey = state.engineKeys[0]; // TODO: 複数エンジン対応
      if (!engineKey) throw new Error(`No such engine registered: index == 0`);
      await dispatch("INVOKE_ENGINE_CONNECTOR", {
        engineKey,
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

    REWRITE_WORD: async (
      { state, dispatch },
      { wordUuid, surface, pronunciation, accentType }
    ) => {
      const engineKey = state.engineKeys[0]; // TODO: 複数エンジン対応
      if (!engineKey) throw new Error(`No such engine registered: index == 0`);
      await dispatch("INVOKE_ENGINE_CONNECTOR", {
        engineKey,
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
      const engineKey = state.engineKeys[0]; // TODO: 複数エンジン対応
      if (!engineKey) throw new Error(`No such engine registered: index == 0`);
      await dispatch("INVOKE_ENGINE_CONNECTOR", {
        engineKey,
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
