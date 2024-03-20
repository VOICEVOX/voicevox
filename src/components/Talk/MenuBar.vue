<template>
  <BaseMenuBar
    editor="talk"
    :file-sub-menu-data="fileSubMenuData"
    :edit-sub-menu-data="editSubMenuData"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { MenuItemData } from "@/components/Menu/type";
import {
  generateAndConnectAndSaveAudioWithDialog,
  multiGenerateAndSaveAudioWithDialog,
  generateAndSaveOneAudioWithDialog,
  connectAndExportTextWithDialog,
} from "@/components/Dialog/Dialog";
import BaseMenuBar from "@/components/Menu/MenuBar/BaseMenuBar.vue";

import { useStore } from "@/store";
import { useHotkeyManager } from "@/plugins/hotkeyPlugin";

const store = useStore();
const { registerHotkeyWithCleanup } = useHotkeyManager();

const uiLocked = computed(() => store.getters.UI_LOCKED);

const generateAndSaveAllAudio = async () => {
  if (!uiLocked.value) {
    await multiGenerateAndSaveAudioWithDialog({
      audioKeys: store.state.audioKeys,
      disableNotifyOnGenerate: store.state.confirmedTips.notifyOnGenerate,
      dispatch: store.dispatch,
    });
  }
};

const generateAndConnectAndSaveAllAudio = async () => {
  if (!uiLocked.value) {
    await generateAndConnectAndSaveAudioWithDialog({
      dispatch: store.dispatch,
      disableNotifyOnGenerate: store.state.confirmedTips.notifyOnGenerate,
    });
  }
};

const generateAndSaveSelectedAudio = async () => {
  if (uiLocked.value) return;

  const activeAudioKey = store.getters.ACTIVE_AUDIO_KEY;
  if (activeAudioKey == undefined) {
    store.dispatch("SHOW_ALERT_DIALOG", {
      title: "テキスト欄が選択されていません",
      message: "音声を書き出したいテキスト欄を選択してください。",
    });
    return;
  }

  const selectedAudioKeys = store.getters.SELECTED_AUDIO_KEYS;
  if (
    store.state.experimentalSetting.enableMultiSelect &&
    selectedAudioKeys.length > 1
  ) {
    await multiGenerateAndSaveAudioWithDialog({
      audioKeys: selectedAudioKeys,
      dispatch: store.dispatch,
      disableNotifyOnGenerate: store.state.confirmedTips.notifyOnGenerate,
    });
  } else {
    await generateAndSaveOneAudioWithDialog({
      audioKey: activeAudioKey,
      disableNotifyOnGenerate: store.state.confirmedTips.notifyOnGenerate,
      dispatch: store.dispatch,
    });
  }
};

const connectAndExportText = async () => {
  if (!uiLocked.value) {
    await connectAndExportTextWithDialog({
      dispatch: store.dispatch,
      disableNotifyOnGenerate: store.state.confirmedTips.notifyOnGenerate,
    });
  }
};

const importTextFile = () => {
  if (!uiLocked.value) {
    store.dispatch("COMMAND_IMPORT_FROM_FILE", {});
  }
};

// 「ファイル」メニュー
const fileSubMenuData = computed<MenuItemData[]>(() => [
  {
    type: "button",
    label: "音声書き出し",
    onClick: () => {
      generateAndSaveAllAudio();
    },
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "選択音声を書き出し",
    onClick: () => {
      generateAndSaveSelectedAudio();
    },
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "音声を繋げて書き出し",
    onClick: () => {
      generateAndConnectAndSaveAllAudio();
    },
    disableWhenUiLocked: true,
  },
  { type: "separator" },
  {
    type: "button",
    label: "テキストを繋げて書き出し",
    onClick: () => {
      connectAndExportText();
    },
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "テキスト読み込み",
    onClick: () => {
      importTextFile();
    },
    disableWhenUiLocked: true,
  },
]);

registerHotkeyWithCleanup({
  editor: "talk",
  name: "音声書き出し",
  callback: () => {
    generateAndSaveAllAudio();
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  name: "選択音声を書き出し",
  callback: () => {
    generateAndSaveSelectedAudio();
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  name: "音声を繋げて書き出し",
  callback: () => {
    generateAndConnectAndSaveAllAudio();
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  name: "テキスト読み込む",
  callback: () => {
    importTextFile();
  },
});

// 「編集」メニュー
const editSubMenuData = computed<MenuItemData[]>(() => []);
</script>
