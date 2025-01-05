import { computed } from "vue";
import { useStore } from "@/store";
import { MenuItemData } from "@/components/Menu/type";
import { useRootMiscSetting } from "@/composables/useRootMiscSetting";
import { ExportSongProjectFileType } from "@/store/type";
import { notifyResult } from "@/components/Dialog/Dialog";

export const useMenuBarData = () => {
  const store = useStore();
  const uiLocked = computed(() => store.getters.UI_LOCKED);
  const isNotesSelected = computed(
    () => store.getters.SELECTED_NOTE_IDS.size > 0,
  );

  const importExternalSongProject = async () => {
    if (uiLocked.value) return;
    await store.actions.SET_DIALOG_OPEN({
      isImportSongProjectDialogOpen: true,
    });
  };

  const exportAudioFile = async () => {
    if (uiLocked.value) return;
    await store.actions.SET_DIALOG_OPEN({
      isExportSongAudioDialogOpen: true,
    });
  };

  const exportSongProject = async (
    fileType: ExportSongProjectFileType,
    fileTypeLabel: string,
  ) => {
    if (uiLocked.value) return;
    const result = await store.actions.EXPORT_SONG_PROJECT({
      fileType,
      fileTypeLabel,
    });
    notifyResult(
      result,
      "project",
      store.actions,
      store.state.confirmedTips.notifyOnGenerate,
    );
  };

  const exportLabelFile = async () => {
    const results = await store.actions.EXPORT_LABEL_FILES({});

    if (results.length === 0) {
      throw new Error("results.length is 0.");
    }
    notifyResult(
      results[0], // TODO: SaveResultObject[] に対応する
      "label",
      store.actions,
      store.state.confirmedTips.notifyOnGenerate,
    );
  };

  // 「ファイル」メニュー
  const fileSubMenuData = computed<MenuItemData[]>(() => [
    {
      type: "button",
      label: "音声書き出し",
      onClick: () => {
        void exportAudioFile();
      },
      disableWhenUiLocked: true,
    },
    {
      type: "button",
      label: "labファイルを書き出し",
      onClick: () => {
        void exportLabelFile();
      },
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: "プロジェクトをインポート",
      onClick: () => {
        void importExternalSongProject();
      },
      disableWhenUiLocked: true,
    },
    {
      type: "root",
      label: "プロジェクトをエクスポート",
      subMenu: (
        [
          ["smf", "MIDI (SMF)"],
          ["musicxml", "MusicXML"],
          ["ufdata", "Utaformatix"],
          ["ust", "UTAU"],
        ] satisfies [fileType: ExportSongProjectFileType, label: string][]
      ).map(
        ([fileType, label]) =>
          ({
            type: "button",
            label,
            onClick: () => {
              void exportSongProject(fileType, label);
            },
            disableWhenUiLocked: true,
          }) satisfies MenuItemData,
      ),
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
        void store.actions.COPY_NOTES_TO_CLIPBOARD();
      },
      disableWhenUiLocked: true,
      disabled: !isNotesSelected.value,
    },
    {
      type: "button",
      label: "切り取り",
      onClick: () => {
        if (uiLocked.value) return;
        void store.actions.COMMAND_CUT_NOTES_TO_CLIPBOARD();
      },
      disableWhenUiLocked: true,
      disabled: !isNotesSelected.value,
    },
    {
      type: "button",
      label: "貼り付け",
      onClick: () => {
        if (uiLocked.value) return;
        void store.actions.COMMAND_PASTE_NOTES_FROM_CLIPBOARD();
      },
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: "すべて選択",
      onClick: () => {
        if (uiLocked.value) return;
        void store.actions.SELECT_ALL_NOTES_IN_TRACK({
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
        void store.actions.DESELECT_ALL_NOTES();
      },
      disableWhenUiLocked: true,
    },
    { type: "separator" },
    {
      type: "button",
      label: "クオンタイズ",
      onClick: () => {
        if (uiLocked.value) return;
        void store.actions.COMMAND_QUANTIZE_SELECTED_NOTES();
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
