<template>
  <BaseMenuBar editor="song" :file-sub-menu-data="fileSubMenuData" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";
import BaseMenuBar from "@/components/Menu/MenuBar/BaseMenuBar.vue";
import { MenuItemData } from "@/components/Menu/type";

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);

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
  {
    type: "button",
    label: "UST読み込み",
    onClick: () => {
      importUstFile();
    },
    disableWhenUiLocked: true,
  },
];
</script>
