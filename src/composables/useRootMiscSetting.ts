import { computed } from "vue";
import { Store } from "@/store";
import { RootMiscSettingType } from "@/type/preload";

/** ルート直下にある雑多な設定値を簡単に扱える便利コンポーザブル */
export const useRootMiscSetting = <T extends keyof RootMiscSettingType>(
  store: Store,
  key: T,
) => {
  const state = computed(() => store.state[key]);
  const setter = (value: RootMiscSettingType[T]) => {
    // Vuexの型処理でUnionが解かれてしまうのを迂回している
    // FIXME: このワークアラウンドをなくす
    void store.actions.SET_ROOT_MISC_SETTING({
      key: key as never,
      value,
    });
  };
  return [state, setter] as const;
};
