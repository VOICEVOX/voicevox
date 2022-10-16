import { UserDictWord, UserDictWordToJSON } from "@/openapi";
import { DictionaryStoreState, DictionaryStoreTypes } from "@/store/type";
import { createPartialStore } from "./vuex";

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

  LOAD_ALL_USER_DICT: {
    async action({ dispatch, state }) {
      const allDict = await Promise.all(
        state.engineIds.map((engineId) => {
          return dispatch("LOAD_USER_DICT", { engineId });
        })
      );
      const mergedDictMap = new Map<string, [string, UserDictWord]>();
      for (const dict of allDict) {
        for (const [id, dictItem] of Object.entries(dict)) {
          mergedDictMap.set(`${dictItem.yomi}-${dictItem.surface}`, [
            id,
            dictItem,
          ]);
        }
      }
      const mergedDict = [...mergedDictMap.values()];
      mergedDict.sort((a, b) => {
        if (a[1].yomi > b[1].yomi) {
          return 1;
        } else {
          return -1;
        }
      });
      return Object.fromEntries(mergedDict);
    },
  },

  ADD_WORD: {
    async action(
      { state, dispatch },
      { surface, pronunciation, accentType, priority }
    ) {
      // 同期処理（SYNC_ALL_USER_DICT）により、一つのエンジンだけに登録しても、他のエンジンにも反映される。
      // むしろ全てのエンジンに登録処理をするとUUIDが合わず、追加した単語が同期処理で再登録される。
      const engineId: string | undefined = state.engineIds[0];

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

      await dispatch("SYNC_ALL_USER_DICT");
    },
  },

  REWRITE_WORD: {
    async action(
      { state, dispatch },
      { wordUuid, surface, pronunciation, accentType, priority }
    ) {
      if (state.engineIds.length === 0)
        throw new Error(`At least one engine must be registered`);
      for (const engineId of state.engineIds) {
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
      }
    },
  },

  DELETE_WORD: {
    async action({ state, dispatch }, { wordUuid }) {
      if (state.engineIds.length === 0)
        throw new Error(`At least one engine must be registered`);
      for (const engineId of state.engineIds) {
        await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
          engineId,
        }).then((instance) =>
          instance.invoke("deleteUserDictWordUserDictWordWordUuidDelete")({
            wordUuid,
          })
        );
      }
    },
  },

  SYNC_ALL_USER_DICT: {
    async action({ dispatch, state }) {
      const mergedDict = await dispatch("LOAD_ALL_USER_DICT");
      for (const engineId of state.engineIds) {
        await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
          engineId,
        }).then((instance) =>
          // マージした辞書をエンジンにインポートする。
          instance.invoke("importUserDictWordsImportUserDictPost")({
            override: true,
            requestBody: Object.fromEntries(
              Object.entries(mergedDict).map(([k, v]) => [
                k,
                UserDictWordToJSON(v),
              ])
            ),
          })
        );

        // エンジンの辞書のIDリストを取得する。
        const removedDictIdSet = await dispatch(
          "INSTANTIATE_ENGINE_CONNECTOR",
          {
            engineId,
          }
        ).then(
          async (instance) =>
            new Set(
              Object.keys(
                await instance.invoke("getUserDictWordsUserDictGet")({})
              )
            )
        );
        // マージされた辞書にあるIDを削除する。
        // これにより、マージ処理で削除された項目のIDが残る。
        for (const id of Object.keys(mergedDict)) {
          if (removedDictIdSet.has(id)) {
            removedDictIdSet.delete(id);
          }
        }

        await dispatch("INSTANTIATE_ENGINE_CONNECTOR", { engineId }).then(
          (instance) => {
            // マージ処理で削除された項目をエンジンから削除する。
            Promise.all(
              [...removedDictIdSet].map((id) =>
                instance.invoke("deleteUserDictWordUserDictWordWordUuidDelete")(
                  {
                    wordUuid: id,
                  }
                )
              )
            );
          }
        );
      }
    },
  },
});
