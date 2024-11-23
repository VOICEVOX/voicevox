<template>
  <QHeader class="q-py-sm">
    <QToolbar>
      <template v-for="button in buttons" :key="button.text">
        <QSpace v-if="button.text === null" />
        <template v-else>
          <QBtn
            v-if="toolbarButtonDisplay === 'ICON_ONLY'"
            unelevated
            :icon="buttonIcons[button.tag]"
            color="toolbar-button"
            textColor="toolbar-button-display"
            class="text-no-wrap text-bold q-mr-sm"
            padding="sm"
            :disable="button.disable.value"
            @click="button.click"
          >
            <QTooltip>
              {{ button.text }}
            </QTooltip>
          </QBtn>
          <QBtn
            v-else
            unelevated
            :icon="
              toolbarButtonDisplay === 'ICON_AND_TEXT'
                ? buttonIcons[button.tag]
                : undefined
            "
            color="toolbar-button"
            textColor="toolbar-button-display"
            class="text-no-wrap text-bold q-mr-sm"
            :disable="button.disable.value"
            @click="button.click"
            >{{ button.text }}</QBtn
          ></template
        >
      </template>
    </QToolbar>
  </QHeader>
</template>

<script setup lang="ts">
import { computed, ComputedRef } from "vue";
import {
  generateAndConnectAndSaveAudioWithDialog,
  multiGenerateAndSaveAudioWithDialog,
  generateAndSaveOneAudioWithDialog,
} from "@/components/Dialog/Dialog";
import { useStore } from "@/store";
import { ToolbarButtonTagType } from "@/type/preload";
import { getToolbarButtonName } from "@/store/utility";
import { useHotkeyManager } from "@/plugins/hotkeyPlugin";
import { handlePossiblyNotMorphableError } from "@/store/audioGenerate";

type ButtonContent = {
  text: string;
  tag: ToolbarButtonTagType;
  click(): void;
  disable: ComputedRef<boolean>;
};

type SpacerContent = {
  text: null;
};

const store = useStore();

const uiLocked = computed(() => store.getters.UI_LOCKED);
const editor = "talk";
const canUndo = computed(() => store.getters.CAN_UNDO(editor));
const canRedo = computed(() => store.getters.CAN_REDO(editor));
const activeAudioKey = computed(() => store.getters.ACTIVE_AUDIO_KEY);
const nowPlayingContinuously = computed(
  () => store.state.nowPlayingContinuously,
);
const toolbarButtonDisplay = computed(() => store.state.toolbarButtonDisplay);

const { registerHotkeyWithCleanup } = useHotkeyManager();
registerHotkeyWithCleanup({
  editor,
  name: "元に戻す",
  callback: () => {
    if (!uiLocked.value && canUndo.value) {
      undo();
    }
  },
});
registerHotkeyWithCleanup({
  editor,
  name: "やり直す",
  callback: () => {
    if (!uiLocked.value && canRedo.value) {
      redo();
    }
  },
});

registerHotkeyWithCleanup({
  editor,
  name: "連続再生/停止",
  callback: () => {
    if (!uiLocked.value) {
      if (nowPlayingContinuously.value) {
        stop();
      } else {
        void playContinuously();
      }
    }
  },
});

const undo = () => {
  void store.actions.UNDO({ editor });
};
const redo = () => {
  void store.actions.REDO({ editor });
};
const playContinuously = async () => {
  try {
    await store.actions.PLAY_CONTINUOUSLY_AUDIO();
  } catch (e) {
    const msg = handlePossiblyNotMorphableError(e);
    void store.actions.SHOW_ALERT_DIALOG({
      title: "再生に失敗しました",
      message: msg ?? "エンジンの再起動をお試しください。",
    });
  }
};
const stop = () => {
  void store.actions.STOP_AUDIO();
};
const generateAndSaveSelectedAudio = async () => {
  if (activeAudioKey.value == undefined)
    throw new Error("activeAudioKey is undefined");

  const selectedAudioKeys = store.getters.SELECTED_AUDIO_KEYS;
  if (
    store.state.experimentalSetting.enableMultiSelect &&
    selectedAudioKeys.length > 1
  ) {
    await multiGenerateAndSaveAudioWithDialog({
      audioKeys: selectedAudioKeys,
      actions: store.actions,
      disableNotifyOnGenerate: store.state.confirmedTips.notifyOnGenerate,
    });
  } else {
    await generateAndSaveOneAudioWithDialog({
      audioKey: activeAudioKey.value,
      disableNotifyOnGenerate: store.state.confirmedTips.notifyOnGenerate,
      actions: store.actions,
    });
  }
};
const generateAndSaveAllAudio = async () => {
  await multiGenerateAndSaveAudioWithDialog({
    audioKeys: store.state.audioKeys,
    actions: store.actions,
    disableNotifyOnGenerate: store.state.confirmedTips.notifyOnGenerate,
  });
};
const generateAndConnectAndSaveAudio = async () => {
  await generateAndConnectAndSaveAudioWithDialog({
    actions: store.actions,
    disableNotifyOnGenerate: store.state.confirmedTips.notifyOnGenerate,
  });
};
const saveProject = async () => {
  await store.actions.SAVE_PROJECT_FILE({ overwrite: true });
};
const importTextFile = () => {
  void store.actions.COMMAND_IMPORT_FROM_FILE({});
};

const usableButtons: Record<
  ToolbarButtonTagType,
  Omit<ButtonContent, "text" | "tag"> | null
> = {
  PLAY_CONTINUOUSLY: {
    click: playContinuously,
    disable: uiLocked,
  },
  STOP: {
    click: stop,
    disable: computed(() => !store.getters.NOW_PLAYING),
  },
  EXPORT_AUDIO_SELECTED: {
    click: generateAndSaveSelectedAudio,
    disable: computed(() => !activeAudioKey.value || uiLocked.value),
  },
  EXPORT_AUDIO_ALL: {
    click: generateAndSaveAllAudio,
    disable: uiLocked,
  },
  EXPORT_AUDIO_CONNECT_ALL: {
    click: generateAndConnectAndSaveAudio,
    disable: uiLocked,
  },
  SAVE_PROJECT: {
    click: saveProject,
    disable: uiLocked,
  },
  UNDO: {
    click: undo,
    disable: computed(() => !canUndo.value || uiLocked.value),
  },
  REDO: {
    click: redo,
    disable: computed(() => !canRedo.value || uiLocked.value),
  },
  IMPORT_TEXT: {
    click: importTextFile,
    disable: uiLocked,
  },
  EMPTY: null,
};

const buttons = computed(() =>
  store.state.toolbarSetting.map<ButtonContent | SpacerContent>((tag) => {
    const buttonContent = usableButtons[tag];
    if (buttonContent) {
      return {
        ...buttonContent,
        tag,
        text: getToolbarButtonName(tag),
      };
    } else {
      return {
        tag,
        text: null,
      };
    }
  }),
);

const buttonIcons: Record<ToolbarButtonTagType, string> = {
  PLAY_CONTINUOUSLY: "playlist_play",
  STOP: "stop",
  EXPORT_AUDIO_SELECTED: "svguse:toolbarIcons.svg#exportSelected",
  EXPORT_AUDIO_ALL: "svguse:toolbarIcons.svg#exportAll",
  EXPORT_AUDIO_CONNECT_ALL: "svguse:toolbarIcons.svg#exportConnectAll",
  UNDO: "undo",
  REDO: "redo",
  IMPORT_TEXT: "svguse:toolbarIcons.svg#importText",
  SAVE_PROJECT: "save",
  EMPTY: "",
};
</script>
