import { createPartialStore } from "./vuex";
import { UserDictWord, UserDictWordToJSON } from "@/openapi";
import { DictionaryStoreState, DictionaryStoreTypes } from "@/store/type";
import { EngineId } from "@/type/preload";

export const dictionaryStoreState: DictionaryStoreState = {};

export const dictionaryStore = createPartialStore<DictionaryStoreTypes>({
  LOAD_USER_DICT: {
    async action({ actions }, { engineId }) {
      const engineDict = await actions
        .INSTANTIATE_ENGINE_CONNECTOR({
          engineId,
        })
        .then((instance) => instance.invoke("getUserDictWordsUserDictGet")({}));

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
    async action({ actions, state }) {
      const allDict = await Promise.all(
        state.engineIds.map((engineId) => {
          return actions.LOAD_USER_DICT({ engineId });
        }),
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
      { state, actions },
      { surface, pronunciation, accentType, priority },
    ) {
      // 同じ単語IDで登録するために、１つのエンジンで登録したあと全エンジンに同期する。
      const engineId: EngineId | undefined = state.engineIds[0];

      if (engineId == undefined)
        throw new Error(`No such engine registered: index == 0`);
      await actions
        .INSTANTIATE_ENGINE_CONNECTOR({
          engineId,
        })
        .then((instance) =>
          instance.invoke("addUserDictWordUserDictWordPost")({
            surface,
            pronunciation,
            accentType,
            priority,
          }),
        );

      await actions.SYNC_ALL_USER_DICT();
    },
  },

  REWRITE_WORD: {
    async action(
      { state, actions },
      { wordUuid, surface, pronunciation, accentType, priority },
    ) {
      if (state.engineIds.length === 0)
        throw new Error(`At least one engine must be registered`);
      for (const engineId of state.engineIds) {
        await actions
          .INSTANTIATE_ENGINE_CONNECTOR({
            engineId,
          })
          .then((instance) =>
            instance.invoke("rewriteUserDictWordUserDictWordWordUuidPut")({
              wordUuid,
              surface,
              pronunciation,
              accentType,
              priority,
            }),
          );
      }
    },
  },

  DELETE_WORD: {
    async action({ state, actions }, { wordUuid }) {
      if (state.engineIds.length === 0)
        throw new Error(`At least one engine must be registered`);
      for (const engineId of state.engineIds) {
        await actions
          .INSTANTIATE_ENGINE_CONNECTOR({
            engineId,
          })
          .then((instance) =>
            instance.invoke("deleteUserDictWordUserDictWordWordUuidDelete")({
              wordUuid,
            }),
          );
      }
    },
  },

  SYNC_ALL_USER_DICT: {
    async action({ actions, state }) {
      const mergedDict = await actions.LOAD_ALL_USER_DICT();
      for (const engineId of state.engineIds) {
        // エンジンの辞書のIDリストを取得する。
        const dictIdSet = await actions
          .INSTANTIATE_ENGINE_CONNECTOR({
            engineId,
          })
          .then(
            async (instance) =>
              new Set(
                Object.keys(
                  await instance.invoke("getUserDictWordsUserDictGet")({}),
                ),
              ),
          );
        if (Object.keys(mergedDict).some((id) => !dictIdSet.has(id))) {
          await actions
            .INSTANTIATE_ENGINE_CONNECTOR({
              engineId,
            })
            .then((instance) =>
              // マージした辞書をエンジンにインポートする。
              instance.invoke("importUserDictWordsImportUserDictPost")({
                override: true,
                requestBody: Object.fromEntries(
                  Object.entries(mergedDict).map(([k, v]) => [
                    k,
                    UserDictWordToJSON(v),
                  ]),
                ),
              }),
            );
        }
        const removedDictIdSet = new Set(dictIdSet);
        // マージされた辞書にあるIDを削除する。
        // これにより、マージ処理で削除された項目のIDが残る。
        for (const id of Object.keys(mergedDict)) {
          if (removedDictIdSet.has(id)) {
            removedDictIdSet.delete(id);
          }
        }

        await actions
          .INSTANTIATE_ENGINE_CONNECTOR({ engineId })
          .then((instance) => {
            // マージ処理で削除された項目をエンジンから削除する。
            void Promise.all(
              [...removedDictIdSet].map((id) =>
                instance.invoke("deleteUserDictWordUserDictWordWordUuidDelete")(
                  {
                    wordUuid: id,
                  },
                ),
              ),
            );
          });
      }
    },
  },
});
