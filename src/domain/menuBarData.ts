import { ref, computed, watch, MaybeRef, unref } from "vue";
import { MenuItemData, MenuItemRoot } from "@/components/Menu/type";
import { useStore } from "@/store";
import { useEngineIcons } from "@/composables/useEngineIcons";
import { HotkeyAction, useHotkeyManager } from "@/plugins/hotkeyPlugin";

export type MenuBarData = {
  file: MenuItemData[];
  edit: MenuItemData[];
  view: MenuItemData[];
  engine: MenuItemData[];
  setting: MenuItemData[];
};
export type MenuBarDataOrRef = {
  file: MaybeRef<MenuItemData[]>;
  edit: MaybeRef<MenuItemData[]>;
  view: MaybeRef<MenuItemData[]>;
  engine: MaybeRef<MenuItemData[]>;
  setting: MaybeRef<MenuItemData[]>;
};

export const useCommonMenuBarData = () => {
  const store = useStore();

  const uiLocked = computed(() => store.getters.UI_LOCKED);
  const engineIds = computed(() => store.state.engineIds);
  const engineInfos = computed(() => store.state.engineInfos);
  const engineManifests = computed(() => store.state.engineManifests);
  const engineIcons = useEngineIcons(engineManifests);
  const enableMultiEngine = computed(() => store.state.enableMultiEngine);

  const editor = computed(() => store.state.openedEditor);
  const canUndo = computed(
    () => editor.value && store.getters.CAN_UNDO(editor.value),
  );
  const canRedo = computed(
    () => editor.value && store.getters.CAN_REDO(editor.value),
  );

  const isMultiSelectEnabled = computed(
    () => store.state.experimentalSetting.enableMultiSelect,
  );

  const audioKeys = computed(() => store.state.audioKeys);

  const createNewProject = async () => {
    if (!uiLocked.value) {
      await store.actions.CREATE_NEW_PROJECT({});
    }
  };

  const saveProject = async () => {
    if (!uiLocked.value) {
      await store.actions.SAVE_PROJECT_FILE({ overwrite: true });
    }
  };

  const saveProjectAs = async () => {
    if (!uiLocked.value) {
      await store.actions.SAVE_PROJECT_FILE({});
    }
  };

  const saveProjectCopy = async () => {
    if (!uiLocked.value) {
      await store.actions.SAVE_PROJECT_FILE_AS_COPY({});
    }
  };

  const importProject = () => {
    if (!uiLocked.value) {
      void store.actions.LOAD_PROJECT_FILE({ type: "dialog" });
    }
  };

  /** UIの拡大 */
  const zoomIn = async () => {
    await store.actions.ZOOM_IN();
  };

  /** UIの縮小 */
  const zoomOut = async () => {
    await store.actions.ZOOM_OUT();
  };

  /** UIの拡大率リセット */
  const zoomReset = async () => {
    await store.actions.ZOOM_RESET();
  };

  const toggleFullScreen = async () => {
    window.backend.toggleFullScreen();
  };

  // 「最近使ったプロジェクト」のメニュー
  const recentProjectsSubMenuData = ref<MenuItemData[]>([]);
  const updateRecentProjects = async () => {
    const recentlyUsedProjects =
      await store.actions.GET_RECENTLY_USED_PROJECTS();
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
              void store.actions.LOAD_PROJECT_FILE({
                type: "path",
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
            void store.actions.RESTART_ENGINES({
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
                    void store.actions.OPEN_ENGINE_DIRECTORY({
                      engineId: engineInfo.uuid,
                    });
                  },
                  disableWhenUiLocked: false,
                },
                {
                  type: "button",
                  label: "再起動",
                  onClick: () => {
                    void store.actions.RESTART_ENGINES({
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
            void store.actions.RESTART_ENGINES({
              engineIds: engineIds.value,
            });
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
          void store.actions.SET_DIALOG_OPEN({
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
          void store.actions.RELOAD_APP({
            isMultiEngineOffMode: false,
          });
        },
        disableWhenUiLocked: false,
        disablreloadingLocked: true,
      });
    }

    return subMenu;
  });

  // TODO: 本来はこのファイルにホットキーの登録を書くべきではないので、どこかに移す。
  const { registerHotkeyWithCleanup } = useHotkeyManager();
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
    callback: saveProjectCopy,
    name: "プロジェクトの複製を保存",
  });
  registerHotkeyForAllEditors({
    callback: importProject,
    name: "プロジェクトを読み込む",
  });
  registerHotkeyForAllEditors({
    callback: toggleFullScreen,
    name: "全画面表示を切り替え",
  });
  registerHotkeyForAllEditors({
    callback: zoomIn,
    name: "拡大",
  });
  registerHotkeyForAllEditors({
    callback: zoomOut,
    name: "縮小",
  });
  registerHotkeyForAllEditors({
    callback: zoomReset,
    name: "拡大率のリセット",
  });

  return computed<MenuBarData>(() => ({
    file: [
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
        label: "プロジェクトの複製を保存",
        onClick: async () => {
          await saveProjectCopy();
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

    edit: [
      {
        type: "button",
        label: "元に戻す",
        onClick: async () => {
          if (!uiLocked.value && editor.value) {
            await store.actions.UNDO({ editor: editor.value });
          }
        },
        disabled: !canUndo.value,
        disableWhenUiLocked: true,
      },
      {
        type: "button",
        label: "やり直す",
        onClick: async () => {
          if (!uiLocked.value && editor.value) {
            await store.actions.REDO({ editor: editor.value });
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
                  await store.actions.SET_SELECTED_AUDIO_KEYS({
                    audioKeys: audioKeys.value,
                  });
                }
              },
              disableWhenUiLocked: true,
            } as const,
          ]
        : []),
    ],

    view: [
      {
        type: "button",
        label: "全画面表示を切り替え",
        onClick: toggleFullScreen,
        disableWhenUiLocked: false,
      },
      {
        type: "button",
        label: "拡大",
        onClick: () => {
          void zoomIn();
        },
        disableWhenUiLocked: false,
      },
      {
        type: "button",
        label: "縮小",
        onClick: () => {
          void zoomOut();
        },
        disableWhenUiLocked: false,
      },
      {
        type: "button",
        label: "拡大率のリセット",
        onClick: () => {
          void zoomReset();
        },
        disableWhenUiLocked: false,
      },
    ],
    engine: engineSubMenuData.value,
    setting: [
      {
        type: "button",
        label: "キー割り当て",
        onClick() {
          void store.actions.SET_DIALOG_OPEN({
            isHotkeySettingDialogOpen: true,
          });
        },
        disableWhenUiLocked: false,
      },
      {
        type: "button",
        label: "ツールバーのカスタマイズ",
        onClick() {
          void store.actions.SET_DIALOG_OPEN({
            isToolbarSettingDialogOpen: true,
          });
        },
        disableWhenUiLocked: false,
      },
      {
        type: "button",
        label: "キャラクター並び替え・試聴",
        onClick() {
          void store.actions.SET_DIALOG_OPEN({
            isCharacterOrderDialogOpen: true,
          });
        },
        disableWhenUiLocked: true,
      },
      {
        type: "button",
        label: "デフォルトスタイル",
        onClick() {
          void store.actions.SET_DIALOG_OPEN({
            isDefaultStyleSelectDialogOpen: true,
          });
        },
        disableWhenUiLocked: true,
      },
      {
        type: "button",
        label: "読み方＆アクセント辞書",
        onClick() {
          void store.actions.SET_DIALOG_OPEN({
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
          void store.actions.SET_DIALOG_OPEN({
            isSettingDialogOpen: true,
          });
        },
        disableWhenUiLocked: false,
      },
    ],
  }));
};

export type MenuBarConcatSpecification = {
  visible: boolean;
  data: MaybeRef<MenuBarDataOrRef>;
  order: Record<keyof MenuBarData, "pre" | "post">;
};

export const concatMenuBarData = (
  menuBarSpecifications: MenuBarConcatSpecification[],
): MenuBarData => {
  const result: MenuBarData = {
    file: [],
    edit: [],
    view: [],
    engine: [],
    setting: [],
  };

  for (const specification of menuBarSpecifications) {
    if (!unref(specification.visible)) {
      continue;
    }
    for (const key of Object.keys(result) as (keyof MenuBarData)[]) {
      const data = unref(specification.data);
      if (specification.order[key] === "pre") {
        result[key] = [
          ...result[key],
          { type: "separator" },
          ...unref(data[key]),
        ];
      } else {
        result[key] = [
          ...unref(data[key]),
          { type: "separator" },
          ...result[key],
        ];
      }
    }
  }

  for (const value of Object.values(result)) {
    for (let i = value.length - 1; i >= 0; i--) {
      if (value[i].type === "separator" && value[i + 1]?.type === "separator") {
        value.splice(i, 1);
      }
    }
  }

  return result;
};
