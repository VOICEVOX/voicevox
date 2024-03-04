<template>
  <BaseMenuBar
    editor="song"
    :file-sub-menu-data="fileSubMenuData"
    :edit-sub-menu-data="editSubMenuData"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";
import BaseMenuBar from "@/components/Menu/MenuBar/BaseMenuBar.vue";
import { MenuItemData } from "@/components/Menu/type";

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);
const editor = "song";
const canUndo = computed(() => store.getters.CAN_UNDO(editor));
const canRedo = computed(() => store.getters.CAN_REDO(editor));
const isNotesSelected = computed(() => store.state.selectedNoteIds.size > 0);

const importMidiFile = async () => {
  if (uiLocked.value) return;
  await store.dispatch("IMPORT_MIDI_FILE", {});
};

const importMusicXMLFile = async () => {
  if (uiLocked.value) return;
  await store.dispatch("IMPORT_MUSICXML_FILE", {});
};

const exportWaveFile = async () => {
  if (uiLocked.value) return;
  await store.dispatch("EXPORT_WAVE_FILE", {});
};

const fileSubMenuData: MenuItemData[] = [
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
];

const editSubMenuData: MenuItemData[] = [
  {
    type: "button",
    label: "元に戻す",
    onClick: () => {
      if (uiLocked.value) return;
      store.dispatch("UNDO", { editor });
    },
    disableWhenUiLocked: true,
    disabled: !canUndo.value,
  },
  {
    type: "button",
    label: "やり直す",
    onClick: () => {
      if (uiLocked.value) return;
      store.dispatch("REDO", { editor });
    },
    disableWhenUiLocked: true,
    disabled: !canRedo.value,
  },
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
      store.dispatch("CUT_NOTES_TO_CLIPBOARD");
    },
    disableWhenUiLocked: true,
    disabled: !isNotesSelected.value,
  },
  {
    type: "button",
    label: "貼り付け",
    onClick: () => {
      if (uiLocked.value) return;
      store.dispatch("PASTE_NOTES_FROM_CLIPBOARD");
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
];
</script>
