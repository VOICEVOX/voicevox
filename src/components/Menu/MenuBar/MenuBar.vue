<template>
  <QBar class="bg-background q-pa-none relative-position">
    <div
      v-if="$q.platform.is.mac && !isFullscreen"
      class="mac-traffic-light-space"
    ></div>
    <img v-else src="/icon.png" class="window-logo" alt="application logo" />
    <MenuButton
      v-for="(root, index) of menudata"
      :key="index"
      v-model:selected="subMenuOpenFlags[index]"
      :menudata="root"
      :disable="menubarLocked"
      @mouseover="reassignSubMenuOpen(index)"
      @mouseleave="
        root.type === 'button' ? (subMenuOpenFlags[index] = false) : undefined
      "
    />
    <QSpace />
    <div class="window-title" :class="{ 'text-warning': isMultiEngineOffMode }">
      {{ titleText }}
    </div>
    <QSpace />
    <TitleBarEditorSwitcher />
    <TitleBarButtons />
  </QBar>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { MenuItemData, MenuItemRoot } from "../type";
import MenuButton from "../MenuButton.vue";
import TitleBarButtons from "./TitleBarButtons.vue";
import TitleBarEditorSwitcher from "./TitleBarEditorSwitcher.vue";
import { useStore } from "@/store";
import { HotkeyAction, useHotkeyManager } from "@/plugins/hotkeyPlugin";
import { useEngineIcons } from "@/composables/useEngineIcons";

const props = defineProps<{
  /** 「ファイル」メニューのサブメニュー */
  fileSubMenuData: MenuItemData[];
  /** 「編集」メニューのサブメニュー */
  editSubMenuData: MenuItemData[];
  /** エディタの種類 */
  editor: "talk" | "song";
}>();

const store = useStore();
const { registerHotkeyWithCleanup } = useHotkeyManager();
const currentVersion = ref("");

const audioKeys = computed(() => store.state.audioKeys);

// デフォルトエンジンの代替先ポート
const defaultEngineAltPortTo = computed<number | undefined>(() => {
  const altPortInfos = store.state.altPortInfos;

  // ref: https://github.com/VOICEVOX/voicevox/blob/32940eab36f4f729dd0390dca98f18656240d60d/src/views/EditorHome.vue#L522-L528
  const defaultEngineInfo = Object.values(store.state.engineInfos).find(
    (engine) => engine.type === "default",
  );
  if (defaultEngineInfo == undefined) return undefined;

  // <defaultEngineId>: { from: number, to: number } -> to (代替先ポート)
  if (defaultEngineInfo.uuid in altPortInfos) {
    return altPortInfos[defaultEngineInfo.uuid].to;
  } else {
    return undefined;
  }
});

window.backend.getAppInfos().then((obj) => {
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
const engineIcons = useEngineIcons(engineManifests);
const enableMultiEngine = computed(() => store.state.enableMultiEngine);
const titleText = computed(
  () =>
    (isEdited.value ? "*" : "") +
    (projectName.value != undefined ? projectName.value + " - " : "") +
    "VOICEVOX" +
    (currentVersion.value ? " - Ver. " + currentVersion.value : "") +
    (isMultiEngineOffMode.value ? " - マルチエンジンオフ" : "") +
    (defaultEngineAltPortTo.value != null
      ? ` - Port: ${defaultEngineAltPortTo.value}`
      : ""),
);
const canUndo = computed(() => store.getters.CAN_UNDO(props.editor));
const canRedo = computed(() => store.getters.CAN_REDO(props.editor));
const isMultiSelectEnabled = computed(
  () => store.state.experimentalSetting.enableMultiSelect,
);

// FIXME: App.vue内に移動する
watch(titleText, (newTitle) => {
  window.document.title = newTitle;
});

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

const createNewProject = async () => {
  if (!uiLocked.value) {
    await store.dispatch("CREATE_NEW_PROJECT", {});
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
    "GET_RECENTLY_USED_PROJECTS",
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

// 「エンジン」メニューのエンジン毎の項目
const engineSubMenuData = computed<MenuItemData[]>(() => {
  let subMenu: MenuItemData[] = [];

  if (Object.values(engineInfos.value).length === 1) {
    const engineInfo = Object.values(engineInfos.value)[0];
    subMenu = [
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
    subMenu = [
      ...store.getters.GET_SORTED_ENGINE_INFOS.map(
        (engineInfo) =>
          ({
            type: "root",
            label: engineInfo.name,
            icon:
              engineManifests.value[engineInfo.uuid] &&
              engineIcons.value[engineInfo.uuid],
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
          }) as MenuItemRoot,
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
    subMenu.push({
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
  // マルチエンジンオフモードの解除
  if (store.state.isMultiEngineOffMode) {
    subMenu.push({
      type: "button",
      label: "マルチエンジンをオンにして再読み込み",
      onClick() {
        store.dispatch("RELOAD_APP", {
          isMultiEngineOffMode: false,
        });
      },
      disableWhenUiLocked: false,
      disablreloadingLocked: true,
    });
  }

  return subMenu;
});

// メニュー一覧
const menudata = computed<MenuItemData[]>(() => [
  {
    type: "root",
    label: "ファイル",
    onClick: () => {
      closeAllDialog();
    },
    disableWhenUiLocked: false,
    subMenu: [
      ...props.fileSubMenuData,
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
        label: "プロジェクトを読み込む",
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
    ],
  },
  {
    type: "root",
    label: "編集",
    onClick: () => {
      closeAllDialog();
    },
    disableWhenUiLocked: false,
    subMenu: [
      {
        type: "button",
        label: "元に戻す",
        onClick: async () => {
          if (!uiLocked.value) {
            await store.dispatch("UNDO", { editor: props.editor });
          }
        },
        disabled: !canUndo.value,
        disableWhenUiLocked: true,
      },
      {
        type: "button",
        label: "やり直す",
        onClick: async () => {
          if (!uiLocked.value) {
            await store.dispatch("REDO", { editor: props.editor });
          }
        },
        disabled: !canRedo.value,
        disableWhenUiLocked: true,
      },
      ...(isMultiSelectEnabled.value
        ? [
            {
              type: "button",
              label: "すべて選択",
              onClick: async () => {
                if (!uiLocked.value && isMultiSelectEnabled.value) {
                  await store.dispatch("SET_SELECTED_AUDIO_KEYS", {
                    audioKeys: audioKeys.value,
                  });
                }
              },
              disableWhenUiLocked: true,
            } as const,
          ]
        : []),
      ...props.editSubMenuData,
    ],
  },
  {
    type: "root",
    label: "エンジン",
    onClick: () => {
      closeAllDialog();
    },
    disableWhenUiLocked: false,
    subMenu: engineSubMenuData.value,
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
  [...Array(menudata.value.length)].map(() => false),
);

const reassignSubMenuOpen = (idx: number) => {
  if (subMenuOpenFlags.value[idx]) return;
  if (subMenuOpenFlags.value.find((x) => x)) {
    const arr = [...Array(menudata.value.length)].map(() => false);
    arr[idx] = true;
    subMenuOpenFlags.value = arr;
  }
};

watch(uiLocked, () => {
  // UIのロックが解除された時に再びメニューが開かれてしまうのを防ぐ
  if (uiLocked.value) {
    subMenuOpenFlags.value = [...Array(menudata.value.length)].map(() => false);
  }
});

/**
 * 全エディタに対してホットキーを登録する
 * FIXME: hotkeyPlugin側で全エディタに対して登録できるようにする
 */
function registerHotkeyForAllEditors(action: Omit<HotkeyAction, "editor">) {
  registerHotkeyWithCleanup({
    editor: "talk",
    ...action,
  });
  registerHotkeyWithCleanup({
    editor: "song",
    ...action,
  });
}

registerHotkeyForAllEditors({
  callback: createNewProject,
  name: "新規プロジェクト",
});
registerHotkeyForAllEditors({
  callback: saveProject,
  name: "プロジェクトを上書き保存",
});
registerHotkeyForAllEditors({
  callback: saveProjectAs,
  name: "プロジェクトを名前を付けて保存",
});
registerHotkeyForAllEditors({
  callback: importProject,
  name: "プロジェクトを読み込む",
});
</script>

<style lang="scss">
@use "@/styles/colors" as colors;

.active-menu {
  background-color: rgba(colors.$primary-rgb, 0.3) !important;
}
</style>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.q-bar {
  min-height: vars.$menubar-height;
  -webkit-app-region: drag; // Electronのドラッグ領域
  :deep(.q-btn) {
    margin-left: 0;
    -webkit-app-region: no-drag; // Electronのドラッグ領域対象から外す
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
