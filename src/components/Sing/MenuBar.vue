<template>
  <base-menu-bar :file-sub-menu-data="fileSubMenuData" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";
import { HotkeyActionType, HotkeyReturnType } from "@/type/preload";
import { setHotkeyFunctions } from "@/store/setting";
import BaseMenuBar, { MenuItemData } from "@/components/BaseMenuBar.vue";

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);

const createNewSingProject = async () => {
  if (uiLocked.value) return;
  return null;
  // await store.dispatch("CREATE_NEW_SING_PROJECT", {});
};

const openSingProject = async () => {
  if (uiLocked.value) return;
  return null;
  // await store.dispatch("OPEN_SING_PROJECT", {});
};

const saveSingProject = async () => {
  if (uiLocked.value) return;
  return null;
  // await store.dispatch("SAVE_SING_PROJECT", {});
};

const saveAsSingProject = async () => {
  if (uiLocked.value) return;
  return null;
  // await store.dispatch("SAVE_AS_SING_PROJECT", {});
};

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
    label: "新規",
    onClick: () => {
      createNewSingProject();
    },
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "開く",
    onClick: () => {
      openSingProject();
    },
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "保存",
    onClick: () => {
      saveSingProject();
    },
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "別名で保存",
    onClick: () => {
      saveAsSingProject();
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
  { type: "separator" },
  {
    type: "button",
    label: "音声を出力",
    onClick: () => {
      exportWaveFile();
    },
    disableWhenUiLocked: true,
  },
];

const hotkeyMap = new Map<HotkeyActionType, () => HotkeyReturnType>([
  // NOTE: 初期設定なし
  // ["新規", createNewSingProject],
]);

setHotkeyFunctions(hotkeyMap);
</script>
