import { computed } from "vue";
import { MenuItemData } from "@/components/Menu/type";

import { useStore } from "@/store";
import { useRootMiscSetting } from "@/composables/useRootMiscSetting";

export const useMenuBarData = () => {
  const store = useStore();

  // 「ファイル」メニュー
  const fileSubMenuData = computed<MenuItemData[]>(() => [
    {
      type: "button",
      label: "音声書き出し",
      onClick: () => {
        void store.actions.SHOW_GENERATE_AND_SAVE_ALL_AUDIO_DIALOG();
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "選択音声を書き出し",
      onClick: () => {
        void store.actions.SHOW_GENERATE_AND_SAVE_SELECTED_AUDIO_DIALOG();
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "音声を繋げて書き出し",
      onClick: () => {
        void store.actions.SHOW_GENERATE_AND_CONNECT_ALL_AUDIO_DIALOG();
      },
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: "テキストを繋げて書き出し",
      onClick: () => {
        void store.actions.SHOW_CONNECT_AND_EXPORT_TEXT_DIALOG();
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "テキスト読み込み",
      onClick: () => {
        void store.actions.COMMAND_IMPORT_FROM_FILE({ type: "dialog" });
      },
      disableWhenUiLocked: true,
    },
  ]);

  // 「編集」メニュー
  const editSubMenuData = computed<MenuItemData[]>(() => []);

  // 「表示」メニュー
  const [showTextLineNumber, changeShowTextLineNumber] = useRootMiscSetting(
    store,
    "showTextLineNumber",
  );
  const viewSubMenuData = computed<MenuItemData[]>(() => [
    {
      type: "button",
      label: showTextLineNumber.value ? "行番号を非表示" : "行番号を表示",
      onClick: () => {
        changeShowTextLineNumber(!showTextLineNumber.value);
      },
      disableWhenUiLocked: true,
    },
  ]);

  return {
    fileSubMenuData,
    editSubMenuData,
    viewSubMenuData,
  };
};
