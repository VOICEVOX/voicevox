<template>
  <q-bar class="bg-background q-pa-none relative-position">
    <div
      v-if="$q.platform.is.mac && !isFullscreen"
      class="mac-traffic-light-space"
    ></div>
    <img v-else src="/icon.png" class="window-logo" alt="application logo" />
    <menu-button
      v-for="(root, index) of menudata"
      :key="index"
      :menudata="root"
      v-model:selected="subMenuOpenFlags[index]"
      :disable="menubarLocked"
      @mouseover="reassignSubMenuOpen(index)"
      @mouseleave="
        root.type === 'button' ? (subMenuOpenFlags[index] = false) : undefined
      "
    />
    <q-space />
    <div class="window-title" :class="{ 'text-warning': isMultiEngineOffMode }">
      {{ titleText }}
    </div>
    <q-space />
    <title-bar-buttons />
  </q-bar>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "@/store";
import MenuButton from "@/components/MenuButton.vue";
import TitleBarButtons from "@/components/TitleBarButtons.vue";
import { HotkeyAction, HotkeyReturnType } from "@/type/preload";
import { setHotkeyFunctions } from "@/store/setting";
import {
  generateAndConnectAndSaveAudioWithDialog,
  generateAndSaveAllAudioWithDialog,
  generateAndSaveOneAudioWithDialog,
  connectAndExportTextWithDialog,
} from "@/components/Dialog";
import { base64ImageToUri } from "@/helpers/imageHelper";

export type MenuItemBase<T extends string> = {
  type: T;
  label?: string;
};

export type MenuItemSeparator = MenuItemBase<"separator">;

export type MenuItemRoot = MenuItemBase<"root"> & {
  onClick?: () => void;
  subMenu: MenuItemData[];
  icon?: string;
  disabled?: boolean;
  disableWhenUiLocked: boolean;
};

export type MenuItemButton = MenuItemBase<"button"> & {
  onClick: () => void;
  icon?: string;
  disabled?: boolean;
  disableWhenUiLocked: boolean;
};

export type MenuItemData = MenuItemSeparator | MenuItemRoot | MenuItemButton;

export type MenuItemType = MenuItemData["type"];

const store = useStore();
const $q = useQuasar();
const currentVersion = ref("");

// デフォルトエンジンの代替先ポート
const defaultEngineAltPortTo = computed<number | undefined>(() => {
  const altPortInfos = store.state.altPortInfos;

  // ref: https://github.com/VOICEVOX/voicevox/blob/32940eab36f4f729dd0390dca98f18656240d60d/src/views/EditorHome.vue#L522-L528
  const defaultEngineInfo = Object.values(store.state.engineInfos).find(
    (engine) => engine.type === "default"
  );
  if (defaultEngineInfo == null) return undefined;

  // <defaultEngineId>: { from: number, to: number } -> to (代替先ポート)
  return altPortInfos[defaultEngineInfo.uuid]?.to;
});

window.electron.getAppInfos().then((obj) => {
  currentVersion.value = obj.version;
});
const isMultiEngineOffMode = computed(() => store.state.isMultiEngineOffMode);
const uiLocked = computed(() => store.getters.UI_LOCKED);
const menubarLocked = computed(() => store.getters.MENUBAR_LOCKED);
const projectName = computed(() => store.getters.PROJECT_NAME);
const isEdited = computed(() => store.getters.IS_EDITED);
const isFullscreen = computed(() => store.getters.IS_FULLSCREEN);
const engineIds = computed(() => store.state.engineIds);
const engineInfos = computed(() => store.state.engineInfos);
const engineManifests = computed(() => store.state.engineManifests);
const enableMultiEngine = computed(
  () => store.state.experimentalSetting.enableMultiEngine
);

const titleText = computed(
  () =>
    (isEdited.value ? "*" : "") +
    (projectName.value !== undefined ? projectName.value + " - " : "") +
    "VOICEVOX" +
    (currentVersion.value ? " - Ver. " + currentVersion.value : "") +
    (isMultiEngineOffMode.value ? " - マルチエンジンオフ" : "") +
    (defaultEngineAltPortTo.value != null
      ? ` - Port: ${defaultEngineAltPortTo.value}`
      : "")
);

// FIXME: App.vue内に移動する
watch(titleText, (newTitle) => {
  window.document.title = newTitle;
});

const createNewProject = async () => {
  if (!uiLocked.value) {
    await store.dispatch("CREATE_NEW_PROJECT", {});
  }
};

const generateAndSaveAllAudio = async () => {
  if (!uiLocked.value) {
    await generateAndSaveAllAudioWithDialog({
      encoding: store.state.savingSetting.fileEncoding,
      quasarDialog: $q.dialog,
      dispatch: store.dispatch,
    });
  }
};

const generateAndConnectAndSaveAllAudio = async () => {
  if (!uiLocked.value) {
    await generateAndConnectAndSaveAudioWithDialog({
      quasarDialog: $q.dialog,
      dispatch: store.dispatch,
      encoding: store.state.savingSetting.fileEncoding,
    });
  }
};

const generateAndSaveOneAudio = async () => {
  if (uiLocked.value) return;

  const activeAudioKey = store.getters.ACTIVE_AUDIO_KEY;
  if (activeAudioKey == undefined) {
    $q.dialog({
      title: "テキスト欄が選択されていません",
      message: "音声を書き出したいテキスト欄を選択してください。",
      ok: {
        label: "閉じる",
        flat: true,
        textColor: "secondary",
      },
    });
    return;
  }

  await generateAndSaveOneAudioWithDialog({
    audioKey: activeAudioKey,
    encoding: store.state.savingSetting.fileEncoding,
    quasarDialog: $q.dialog,
    dispatch: store.dispatch,
  });
};

const connectAndExportText = async () => {
  if (!uiLocked.value) {
    await connectAndExportTextWithDialog({
      quasarDialog: $q.dialog,
      dispatch: store.dispatch,
      encoding: store.state.savingSetting.fileEncoding,
    });
  }
};

const importTextFile = () => {
  if (!uiLocked.value) {
    store.dispatch("COMMAND_IMPORT_FROM_FILE", {});
  }
};

const saveProject = () => {
  if (!uiLocked.value) {
    store.dispatch("SAVE_PROJECT_FILE", { overwrite: true });
  }
};

const saveProjectAs = () => {
  if (!uiLocked.value) {
    store.dispatch("SAVE_PROJECT_FILE", {});
  }
};

const importProject = () => {
  if (!uiLocked.value) {
    store.dispatch("LOAD_PROJECT_FILE", {});
  }
};
const closeAllDialog = () => {
  store.dispatch("SET_DIALOG_OPEN", {
    isSettingDialogOpen: false,
  });
  store.dispatch("SET_DIALOG_OPEN", {
    isHelpDialogOpen: false,
  });
  store.dispatch("SET_DIALOG_OPEN", {
    isHotkeySettingDialogOpen: false,
  });
  store.dispatch("SET_DIALOG_OPEN", {
    isToolbarSettingDialogOpen: false,
  });
  store.dispatch("SET_DIALOG_OPEN", {
    isCharacterOrderDialogOpen: false,
  });
  store.dispatch("SET_DIALOG_OPEN", {
    isDefaultStyleSelectDialogOpen: false,
  });
};

const openHelpDialog = () => {
  store.dispatch("SET_DIALOG_OPEN", {
    isHelpDialogOpen: true,
  });
};

const menudata = ref<MenuItemData[]>([
  {
    type: "root",
    label: "ファイル",
    onClick: () => {
      closeAllDialog();
    },
    disableWhenUiLocked: false,
    subMenu: [
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
        label: "一つだけ書き出し",
        onClick: () => {
          generateAndSaveOneAudio();
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
        onClick: () => {
          saveProject();
        },
        disableWhenUiLocked: true,
      },
      {
        type: "button",
        label: "プロジェクトを名前を付けて保存",
        onClick: () => {
          saveProjectAs();
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
        subMenu: [],
      },
    ],
  },
  {
    type: "root",
    label: "エンジン",
    onClick: () => {
      closeAllDialog();
    },
    disableWhenUiLocked: false,
    subMenu: [],
  },
  {
    type: "root",
    label: "設定",
    onClick: () => {
      closeAllDialog();
    },
    disableWhenUiLocked: false,
    subMenu: [
      {
        type: "button",
        label: "キー割り当て",
        onClick() {
          store.dispatch("SET_DIALOG_OPEN", {
            isHotkeySettingDialogOpen: true,
          });
        },
        disableWhenUiLocked: false,
      },
      {
        type: "button",
        label: "ツールバーのカスタマイズ",
        onClick() {
          store.dispatch("SET_DIALOG_OPEN", {
            isToolbarSettingDialogOpen: true,
          });
        },
        disableWhenUiLocked: false,
      },
      {
        type: "button",
        label: "キャラクター並び替え・試聴",
        onClick() {
          store.dispatch("SET_DIALOG_OPEN", {
            isCharacterOrderDialogOpen: true,
          });
        },
        disableWhenUiLocked: true,
      },
      {
        type: "button",
        label: "デフォルトスタイル",
        onClick() {
          store.dispatch("SET_DIALOG_OPEN", {
            isDefaultStyleSelectDialogOpen: true,
          });
        },
        disableWhenUiLocked: true,
      },
      {
        type: "button",
        label: "読み方＆アクセント辞書",
        onClick() {
          store.dispatch("SET_DIALOG_OPEN", {
            isDictionaryManageDialogOpen: true,
          });
        },
        disableWhenUiLocked: true,
      },
      { type: "separator" },
      {
        type: "button",
        label: "オプション",
        onClick() {
          store.dispatch("SET_DIALOG_OPEN", {
            isSettingDialogOpen: true,
          });
        },
        disableWhenUiLocked: false,
      },
    ],
  },
  {
    type: "button",
    label: "ヘルプ",
    onClick: () => {
      if (store.state.isHelpDialogOpen) closeAllDialog();
      else {
        closeAllDialog();
        openHelpDialog();
      }
    },
    disableWhenUiLocked: false,
  },
]);

const subMenuOpenFlags = ref(
  [...Array(menudata.value.length)].map(() => false)
);

const reassignSubMenuOpen = (idx: number) => {
  if (subMenuOpenFlags.value[idx]) return;
  if (subMenuOpenFlags.value.find((x) => x)) {
    const arr = [...Array(menudata.value.length)].map(() => false);
    arr[idx] = true;
    subMenuOpenFlags.value = arr;
  }
};

const hotkeyMap = new Map<HotkeyAction, () => HotkeyReturnType>([
  ["新規プロジェクト", createNewProject],
  ["音声書き出し", generateAndSaveAllAudio],
  ["一つだけ書き出し", generateAndSaveOneAudio],
  ["音声を繋げて書き出し", generateAndConnectAndSaveAllAudio],
  ["テキスト読み込む", importTextFile],
  ["プロジェクトを上書き保存", saveProject],
  ["プロジェクトを名前を付けて保存", saveProjectAs],
  ["プロジェクト読み込み", importProject],
]);

setHotkeyFunctions(hotkeyMap);

// エンジン毎の項目を追加
async function updateEngines() {
  const engineMenu = menudata.value.find(
    (x) => x.type === "root" && x.label === "エンジン"
  ) as MenuItemRoot;
  if (Object.values(engineInfos.value).length === 1) {
    const engineInfo = Object.values(engineInfos.value)[0];
    engineMenu.subMenu = [
      {
        type: "button",
        label: "再起動",
        onClick: () => {
          store.dispatch("RESTART_ENGINES", {
            engineIds: [engineInfo.uuid],
          });
        },
        disableWhenUiLocked: false,
      },
    ].filter((x) => x) as MenuItemData[];
  } else {
    engineMenu.subMenu = [
      ...store.getters.GET_SORTED_ENGINE_INFOS.map(
        (engineInfo) =>
          ({
            type: "root",
            label: engineInfo.name,
            icon:
              engineManifests.value[engineInfo.uuid] &&
              base64ImageToUri(engineManifests.value[engineInfo.uuid].icon),
            subMenu: [
              engineInfo.path && {
                type: "button",
                label: "フォルダを開く",
                onClick: () => {
                  store.dispatch("OPEN_ENGINE_DIRECTORY", {
                    engineId: engineInfo.uuid,
                  });
                },
                disableWhenUiLocked: false,
              },
              {
                type: "button",
                label: "再起動",
                onClick: () => {
                  store.dispatch("RESTART_ENGINES", {
                    engineIds: [engineInfo.uuid],
                  });
                },
                disableWhenUiLocked: false,
              },
            ].filter((x) => x),
          } as MenuItemRoot)
      ),
      {
        type: "separator",
      },
      {
        type: "button",
        label: "全てのエンジンを再起動",
        onClick: () => {
          store.dispatch("RESTART_ENGINES", { engineIds: engineIds.value });
        },
        disableWhenUiLocked: false,
      },
    ];
  }
  if (enableMultiEngine.value) {
    engineMenu.subMenu.push({
      type: "button",
      label: "エンジンの管理",
      onClick: () => {
        store.dispatch("SET_DIALOG_OPEN", {
          isEngineManageDialogOpen: true,
        });
      },
      disableWhenUiLocked: false,
    });
  }
}
// engineInfos、engineManifests、enableMultiEngineを見て動的に更新できるようにする
// FIXME: computedにする
watch([engineInfos, engineManifests, enableMultiEngine], updateEngines, {
  immediate: true,
});

// マルチエンジンオフモードの解除
if (store.state.isMultiEngineOffMode) {
  (
    menudata.value.find((data) => data.label === "エンジン") as MenuItemRoot
  ).subMenu.push({
    type: "button",
    label: "マルチエンジンをオンにして再起動",
    onClick() {
      store.dispatch("RESTART_APP", {
        isMultiEngineOffMode: false,
      });
    },
    disableWhenUiLocked: false,
  });
}

// 「最近開いたプロジェクト」の更新
async function updateRecentProjects() {
  const projectsMenu = menudata.value.find(
    (x) => x.type === "root" && x.label === "ファイル"
  ) as MenuItemRoot;
  const recentProjectsMenu = projectsMenu.subMenu.find(
    (x) => x.type === "root" && x.label === "最近使ったプロジェクト"
  ) as MenuItemRoot;

  const recentlyUsedProjects = await store.dispatch(
    "GET_RECENTLY_USED_PROJECTS"
  );
  recentProjectsMenu.subMenu =
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
      : recentlyUsedProjects.map(
          (projectFilePath) =>
            ({
              type: "button",
              label: projectFilePath,
              onClick: () => {
                store.dispatch("LOAD_PROJECT_FILE", {
                  filePath: projectFilePath,
                });
              },
              disableWhenUiLocked: false,
            } as MenuItemData)
        );
}

const projectFilePath = computed(() => store.state.projectFilePath);

watch(projectFilePath, updateRecentProjects, {
  immediate: true,
});

watch(uiLocked, () => {
  // UIのロックが解除された時に再びメニューが開かれてしまうのを防ぐ
  if (uiLocked.value) {
    subMenuOpenFlags.value = [...Array(menudata.value.length)].map(() => false);
  }
});
</script>

<style lang="scss">
@use '@/styles/colors' as colors;

.active-menu {
  background-color: rgba(colors.$primary-rgb, 0.3) !important;
}
</style>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.q-bar {
  min-height: vars.$menubar-height;
  -webkit-app-region: drag;
  > .q-btn {
    margin-left: 0;
    -webkit-app-region: no-drag;
  }
}

.window-logo {
  height: vars.$menubar-height;
}

.window-title {
  height: vars.$menubar-height;
  margin-right: 10%;
  text-overflow: ellipsis;
  overflow: hidden;
}

.mac-traffic-light-space {
  margin-right: 70px;
}
</style>
