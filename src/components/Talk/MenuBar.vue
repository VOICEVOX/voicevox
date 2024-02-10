<template>
  <base-menu-bar :file-sub-menu-data="fileSubMenuData" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
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
const hotkeyManager = useHotkeyManager();

const uiLocked = computed(() => store.getters.UI_LOCKED);

const createNewProject = async () => {
  if (!uiLocked.value) {
    await store.dispatch("CREATE_NEW_PROJECT", {});
  }
};

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

const saveProject = async () => {
  if (!uiLocked.value) {
    await store.dispatch("SAVE_PROJECT_FILE", { overwrite: true });
  }
};

const saveProjectAs = async () => {
  if (!uiLocked.value) {
    await store.dispatch("SAVE_PROJECT_FILE", {});
  }
};

const importProject = () => {
  if (!uiLocked.value) {
    store.dispatch("LOAD_PROJECT_FILE", {});
  }
};

// 「最近使ったプロジェクト」のメニュー
const recentProjectsSubMenuData = ref<MenuItemData[]>([]);
const updateRecentProjects = async () => {
  const recentlyUsedProjects = await store.dispatch(
    "GET_RECENTLY_USED_PROJECTS"
  );
  recentProjectsSubMenuData.value =
    recentlyUsedProjects.length === 0
      ? [
          {
            type: "button",
            label: "最近使ったプロジェクトはありません",
            onClick: () => {
              // 何もしない
            },
            disabled: true,
            disableWhenUiLocked: false,
          },
        ]
      : recentlyUsedProjects.map((projectFilePath) => ({
          type: "button",
          label: projectFilePath,
          onClick: () => {
            store.dispatch("LOAD_PROJECT_FILE", {
              filePath: projectFilePath,
            });
          },
          disableWhenUiLocked: false,
        }));
};
const projectFilePath = computed(() => store.state.projectFilePath);
watch(projectFilePath, updateRecentProjects, {
  immediate: true,
});

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
  { type: "separator" },
  {
    type: "button",
    label: "新規プロジェクト",
    onClick: createNewProject,
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "プロジェクトを上書き保存",
    onClick: async () => {
      await saveProject();
    },
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "プロジェクトを名前を付けて保存",
    onClick: async () => {
      await saveProjectAs();
    },
    disableWhenUiLocked: true,
  },
  {
    type: "button",
    label: "プロジェクト読み込み",
    onClick: () => {
      importProject();
    },
    disableWhenUiLocked: true,
  },
  {
    type: "root",
    label: "最近使ったプロジェクト",
    disableWhenUiLocked: true,
    subMenu: recentProjectsSubMenuData.value,
  },
]);

hotkeyManager.register({
  editor: "talk",
  action: "新規プロジェクト",
  callback: () => {
    createNewProject();
  },
});
hotkeyManager.register({
  editor: "talk",
  action: "音声書き出し",
  callback: () => {
    generateAndSaveAllAudio();
  },
});
hotkeyManager.register({
  editor: "talk",
  action: "選択音声を書き出し",
  callback: () => {
    generateAndSaveSelectedAudio();
  },
});
hotkeyManager.register({
  editor: "talk",
  action: "音声を繋げて書き出し",
  callback: () => {
    generateAndConnectAndSaveAllAudio();
  },
});
hotkeyManager.register({
  editor: "talk",
  action: "テキスト読み込む",
  callback: () => {
    importTextFile();
  },
});
hotkeyManager.register({
  editor: "talk",
  action: "プロジェクトを上書き保存",
  callback: () => {
    saveProject();
  },
});
hotkeyManager.register({
  editor: "talk",
  action: "プロジェクトを名前を付けて保存",
  callback: () => {
    saveProjectAs();
  },
});
hotkeyManager.register({
  editor: "talk",
  action: "プロジェクト読み込み",
  callback: () => {
    importProject();
  },
});
</script>
