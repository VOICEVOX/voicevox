import { computed } from "vue";
import { useStore } from "@/store";
import { MenuItemData } from "@/components/Menu/type";

export const useMenuBarData = () => {
  const store = useStore();
  const uiLocked = computed(() => store.getters.UI_LOCKED);
  const isNotesSelected = computed(() => store.state.selectedNoteIds.size > 0);

  const importExternalSongProject = async () => {
    if (uiLocked.value) return;
    await store.dispatch("SET_DIALOG_OPEN", {
      isImportSongProjectDialogOpen: true,
    });
  };

  const exportWaveFile = async () => {
    if (uiLocked.value) return;
    await store.dispatch("EXPORT_WAVE_FILE", {});
  };

  const fileSubMenuData = computed<MenuItemData[]>(() => [
    {
      type: "button",
      label: "音声を出力",
      onClick: () => {
        exportWaveFile();
      },
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: "インポート",
      onClick: () => {
        importExternalSongProject();
      },
      disableWhenUiLocked: true,
    },
  ]);

  const editSubMenuData = computed<MenuItemData[]>(() => [
    { type: "separator" },
    {
      type: "button",
      label: "コピー",
      onClick: () => {
        if (uiLocked.value) return;
        store.dispatch("COPY_NOTES_TO_CLIPBOARD");
      },
      disableWhenUiLocked: true,
      disabled: !isNotesSelected.value,
    },
    {
      type: "button",
      label: "切り取り",
      onClick: () => {
        if (uiLocked.value) return;
        store.dispatch("COMMAND_CUT_NOTES_TO_CLIPBOARD");
      },
      disableWhenUiLocked: true,
      disabled: !isNotesSelected.value,
    },
    {
      type: "button",
      label: "貼り付け",
      onClick: () => {
        if (uiLocked.value) return;
        store.dispatch("COMMAND_PASTE_NOTES_FROM_CLIPBOARD");
      },
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: "すべて選択",
      onClick: () => {
        if (uiLocked.value) return;
        store.dispatch("SELECT_ALL_NOTES");
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "選択解除",
      onClick: () => {
        if (uiLocked.value) return;
        store.dispatch("DESELECT_ALL_NOTES");
      },
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: "クオンタイズ",
      onClick: () => {
        if (uiLocked.value) return;
        store.dispatch("COMMAND_QUANTIZE_SELECTED_NOTES");
      },
      disableWhenUiLocked: true,
    },
  ]);

  return { fileSubMenuData, editSubMenuData };
};
