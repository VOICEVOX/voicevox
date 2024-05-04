import { computed } from "vue";
import { useStore } from "@/store";
import { MenuItemData } from "@/components/Menu/type";

export const useMenuBarData = () => {
  const store = useStore();
  const uiLocked = computed(() => store.getters.UI_LOCKED);
  const isNotesSelected = computed(() => store.state.selectedNoteIds.size > 0);

  const importMidiFile = async () => {
    if (uiLocked.value) return;
    await store.dispatch("SET_DIALOG_OPEN", {
      isImportMidiDialogOpen: true,
    });
  };

  const importMusicXMLFile = async () => {
    if (uiLocked.value) return;
    await store.dispatch("IMPORT_MUSICXML_FILE", {});
  };

  const importUstFile = async () => {
    if (uiLocked.value) return;
    await store.dispatch("IMPORT_UST_FILE", {});
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
      label: "MIDI読み込み",
      onClick: () => {
        importMidiFile();
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "MusicXML読み込み",
      onClick: () => {
        importMusicXMLFile();
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "UST読み込み",
      onClick: () => {
        importUstFile();
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
