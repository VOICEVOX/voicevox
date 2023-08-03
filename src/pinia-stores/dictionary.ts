import { defineStore } from "pinia";

import { EngineId } from "@/type/preload";
import { UserDictWord, UserDictWordToJSON } from "@/openapi";
import { useStore as useVuexStore } from "@/store";

export const useDictionary = defineStore("dictionary", () => {
  const vuexStore = useVuexStore();

  const loadUserDict = async ({ engineId }: { engineId: EngineId }) => {
    const engineDict = await vuexStore
      .dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
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
  };

  const loadAllUserDict = async () => {
    const allDict = await Promise.all(
      vuexStore.state.engineIds.map((engineId) => {
        return loadUserDict({ engineId });
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
  };

  const addWord = async ({
    surface,
    pronunciation,
    accentType,
    priority,
  }: {
    surface: string;
    pronunciation: string;
    accentType: number;
    priority: number;
  }) => {
    // 同じ単語IDで登録するために、１つのエンジンで登録したあと全エンジンに同期する。
    const engineId: EngineId | undefined = vuexStore.state.engineIds[0];
    if (engineId === undefined)
      throw new Error(`No such engine registered: index == 0`);
    await vuexStore
      .dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
        engineId,
      })
      .then((instance) =>
        instance.invoke("addUserDictWordUserDictWordPost")({
          surface,
          pronunciation,
          accentType,
          priority,
        })
      );

    await syncAllUserDict();
  };

  const rewriteWord = async ({
    wordUuid,
    surface,
    pronunciation,
    accentType,
    priority,
  }: {
    wordUuid: string;
    surface: string;
    pronunciation: string;
    accentType: number;
    priority: number;
  }) => {
    if (vuexStore.state.engineIds.length === 0)
      throw new Error(`At least one engine must be registered`);
    for (const engineId of vuexStore.state.engineIds) {
      await vuexStore
        .dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
          engineId,
        })
        .then((instance) =>
          instance.invoke("rewriteUserDictWordUserDictWordWordUuidPut")({
            wordUuid,
            surface,
            pronunciation,
            accentType,
            priority,
          })
        );
    }
  };

  const deleteWord = async ({ wordUuid }: { wordUuid: string }) => {
    if (vuexStore.state.engineIds.length === 0)
      throw new Error(`At least one engine must be registered`);
    for (const engineId of vuexStore.state.engineIds) {
      await vuexStore
        .dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
          engineId,
        })
        .then((instance) =>
          instance.invoke("deleteUserDictWordUserDictWordWordUuidDelete")({
            wordUuid,
          })
        );
    }
  };

  const syncAllUserDict = async () => {
    const mergedDict = await loadAllUserDict();
    for (const engineId of vuexStore.state.engineIds) {
      // エンジンの辞書のIDリストを取得する。
      const dictIdSet = await vuexStore
        .dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
          engineId,
        })
        .then(
          async (instance) =>
            new Set(
              Object.keys(
                await instance.invoke("getUserDictWordsUserDictGet")({})
              )
            )
        );
      if (Object.keys(mergedDict).some((id) => !dictIdSet.has(id))) {
        await vuexStore
          .dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
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
                ])
              ),
            })
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

      await vuexStore
        .dispatch("INSTANTIATE_ENGINE_CONNECTOR", { engineId })
        .then((instance) => {
          // マージ処理で削除された項目をエンジンから削除する。
          Promise.all(
            [...removedDictIdSet].map((id) =>
              instance.invoke("deleteUserDictWordUserDictWordWordUuidDelete")({
                wordUuid: id,
              })
            )
          );
        });
    }
  };

  return {
    loadUserDict,
    loadAllUserDict,
    addWord,
    rewriteWord,
    deleteWord,
    syncAllUserDict,
  };
});
