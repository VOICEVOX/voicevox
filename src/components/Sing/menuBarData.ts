import { computed } from "vue";
import { useStore } from "@/store";
import { isVst } from "@/type/preload";
import { MenuItemData } from "@/components/Menu/type";
import { useRootMiscSetting } from "@/composables/useRootMiscSetting";

export const useMenuBarData = () => {
  const store = useStore();
  const uiLocked = computed(() => store.getters.UI_LOCKED);
  const isNotesSelected = computed(
    () => store.getters.SELECTED_NOTE_IDS.size > 0,
  );

  const importExternalSongProject = async () => {
    if (uiLocked.value) return;
    await store.dispatch("SET_DIALOG_OPEN", {
      isImportSongProjectDialogOpen: true,
    });
  };

  const exportAudioFile = async () => {
    if (uiLocked.value) return;
    await store.dispatch("SET_DIALOG_OPEN", {
      isExportSongAudioDialogOpen: true,
    });
  };

  // 「ファイル」メニュー
  const fileSubMenuData = computed<MenuItemData[]>(() => [
    ...(isVst
      ? []
      : [
          {
            type: "button",
            label: "音声を出力",
            onClick: () => {
              void exportAudioFile();
            },
            disableWhenUiLocked: true,
          },
          { type: "separator" },
        ]),
    {
      type: "button",
      label: "インポート",
      onClick: () => {
        void importExternalSongProject();
      },
      disableWhenUiLocked: true,
    },
  ]);

  // 「編集」メニュー
  const editSubMenuData = computed<MenuItemData[]>(() => [
    { type: "separator" },
    {
      type: "button",
      label: "コピー",
      onClick: () => {
        if (uiLocked.value) return;
        void store.dispatch("COPY_NOTES_TO_CLIPBOARD");
      },
      disableWhenUiLocked: true,
      disabled: !isNotesSelected.value,
    },
    {
      type: "button",
      label: "切り取り",
      onClick: () => {
        if (uiLocked.value) return;
        void store.dispatch("COMMAND_CUT_NOTES_TO_CLIPBOARD");
      },
      disableWhenUiLocked: true,
      disabled: !isNotesSelected.value,
    },
    {
      type: "button",
      label: "貼り付け",
      onClick: () => {
        if (uiLocked.value) return;
        void store.dispatch("COMMAND_PASTE_NOTES_FROM_CLIPBOARD");
      },
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: "すべて選択",
      onClick: () => {
        if (uiLocked.value) return;
        void store.dispatch("SELECT_ALL_NOTES_IN_TRACK", {
          trackId: store.getters.SELECTED_TRACK_ID,
        });
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "選択解除",
      onClick: () => {
        if (uiLocked.value) return;
        void store.dispatch("DESELECT_ALL_NOTES");
      },
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: "クオンタイズ",
      onClick: () => {
        if (uiLocked.value) return;
        void store.dispatch("COMMAND_QUANTIZE_SELECTED_NOTES");
      },
      disableWhenUiLocked: true,
    },
  ]);

  // 「表示」メニュー
  const [showSingCharacterPortrait, setShowSingCharacterPortrait] =
    useRootMiscSetting(store, "showSingCharacterPortrait");
  const viewSubMenuData = computed<MenuItemData[]>(() => [
    {
      type: "button",
      label: showSingCharacterPortrait.value
        ? "立ち絵を非表示"
        : "立ち絵を表示",
      onClick: () => {
        setShowSingCharacterPortrait(!showSingCharacterPortrait.value);
      },
      disableWhenUiLocked: true,
    },
  ]);

  return { fileSubMenuData, editSubMenuData, viewSubMenuData };
};
