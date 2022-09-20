import { UserDictWord } from "@/openapi";
import { DictionaryStoreState, DictionaryStoreTypes } from "@/store/type";
import { createPartialStore } from "./utility";

export const dictionaryStoreState: DictionaryStoreState = {};

export const dictionaryStore = createPartialStore<DictionaryStoreTypes>({
  LOAD_USER_DICT: {
    async action({ dispatch }, { engineId }) {
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
  },

  ADD_WORD: {
    async action(
      { state, dispatch },
      { surface, pronunciation, accentType, priority }
    ) {
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
  },

  REWRITE_WORD: {
    async action(
      { state, dispatch },
      { wordUuid, surface, pronunciation, accentType, priority }
    ) {
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
  },

  DELETE_WORD: {
    async action({ state, dispatch }, { wordUuid }) {
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
});
