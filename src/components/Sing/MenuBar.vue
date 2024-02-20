<template>
  <base-menu-bar :file-sub-menu-data="fileSubMenuData" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { MenuItemData } from "@/components/Menu/type";
import { useStore } from "@/store";
import { HotkeyActionType, HotkeyReturnType } from "@/type/preload";
import { setHotkeyFunctions } from "@/store/setting";
import BaseMenuBar from "@/components/Menu/MenuBar/BaseMenuBar.vue";

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);

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

const hotkeyMap = new Map<HotkeyActionType, () => HotkeyReturnType>([
  // NOTE: 初期設定なし
  // ["新規", createNewSingProject],
]);

setHotkeyFunctions(hotkeyMap);
</script>
