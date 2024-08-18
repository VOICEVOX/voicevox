import { computed } from "vue";
import { useStore } from "@/store";
import { MenuItemData } from "@/components/Menu/type";

export const useMenuBarData = () => {
  const store = useStore();
  const uiLocked = computed(() => store.getters.UI_LOCKED);
  const isNotesSelected = computed(
    () => store.getters.SELECTED_NOTE_IDS.size > 0,
  );
  const showSinger = computed({
    get: () => store.state.showSinger,
    set: (showSinger: boolean) => {
      void store.dispatch("SET_ROOT_MISC_SETTING", {
        key: "showSinger",
        value: showSinger,
      });
    },
  });

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

  const exportStemWaveFile = async () => {
    if (uiLocked.value) return;
    await store.dispatch("EXPORT_STEM_WAVE_FILE", {});
  };

  const fileSubMenuData = computed<MenuItemData[]>(() =>
    (
      [
        {
          type: "button",
          label: "音声を出力",
          onClick: () => {
            void exportWaveFile();
          },
          disableWhenUiLocked: true,
        },
        store.state.experimentalSetting.enableMultiTrack && {
          type: "button",
          label: "トラック毎の音声を出力",
          onClick: () => {
            void exportStemWaveFile();
          },
          disableWhenUiLocked: true,
        },
        { type: "separator" },
        {
          type: "button",
          label: "インポート",
          onClick: () => {
            void importExternalSongProject();
          },
          disableWhenUiLocked: true,
        },
      ] satisfies (MenuItemData | false)[]
    ).filter((item) => !!item),
  );

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

  const viewSubMenuData = computed<MenuItemData[]>(() => [
    {
      type: "button",
      label: showSinger.value ? "立ち絵を非表示" : "立ち絵を表示",
      onClick: () => {
        showSinger.value = !showSinger.value;
      },
      disableWhenUiLocked: true,
    },
  ]);

  return { fileSubMenuData, editSubMenuData, viewSubMenuData };
};
