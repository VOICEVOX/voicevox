import { computed } from "vue";
import type { Store } from "@/store";
import { useRootMiscSetting } from "@/composables/useRootMiscSetting";
import type {
  MaybeComputedMenuBarContent,
  MenuBarContent,
} from "@/components/Menu/MenuBar/menuBarData";

export const useMenuBarData = (store: Store): MaybeComputedMenuBarContent => {
  // 「ファイル」メニュー
  const fileSubMenuData = computed<MenuBarContent["file"]>(() => ({
    audioExport: [
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
    ],
    externalProject: [
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
    ],
  }));

  // 「表示」メニュー
  const [showTextLineNumber, changeShowTextLineNumber] = useRootMiscSetting(
    store,
    "showTextLineNumber",
  );
  const viewSubMenuData = computed<MenuBarContent["view"]>(() => ({
    guide: [
      {
        type: "button",
        label: showTextLineNumber.value ? "行番号を非表示" : "行番号を表示",
        onClick: () => {
          changeShowTextLineNumber(!showTextLineNumber.value);
        },
        disableWhenUiLocked: true,
      },
    ],
  }));

  return {
    file: fileSubMenuData,
    view: viewSubMenuData,
  };
};
