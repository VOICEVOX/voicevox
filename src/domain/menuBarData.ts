import { ref, computed, watch, MaybeRef, ComputedRef, unref } from "vue";
import { MenuItemData } from "@/components/Menu/type";
import { Store } from "@/store";
import { HotkeyAction, useHotkeyManager } from "@/plugins/hotkeyPlugin";
import { ensureNotNullish } from "@/helpers/errorHelper";
import { flatWithSeparator } from "@/helpers/arrayHelper";

type MenuBarCategories = "file" | "edit" | "view" | "engine" | "setting";

const menuItemStructure = {
  file: ["audioExport", "externalProject", "project"],
  edit: ["undoRedo", "copyPaste", "select", "misc"],
  view: ["guide", "portrait", "window"],
  engine: ["singleEngine", "allEngines"],
  setting: ["subOptions", "options"],
} as const satisfies Record<MenuBarCategories, string[]>;

export type MenuBarContent = Partial<{
  [K in MenuBarCategories]: Partial<
    Record<(typeof menuItemStructure)[K][number], MenuItemData[]>
  >;
}>;
export type MaybeComputedMenuBarContent = Partial<{
  [K in MenuBarCategories]: ComputedRef<MenuBarContent[K]> | MenuBarContent[K];
}>;

export const useCommonMenuBarData = (store: Store) => {
  const uiLocked = computed(() => store.getters.UI_LOCKED);

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

  return computed<MaybeComputedMenuBarContent>(() => ({
    file: {
      project: [
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
    },

    edit: {
      undoRedo: [
        {
          type: "button",
          label: "元に戻す",
          onClick: async () => {
            if (!uiLocked.value) {
              await store.actions.UNDO({
                editor: ensureNotNullish(editor.value),
              });
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
              await store.actions.REDO({
                editor: ensureNotNullish(editor.value),
              });
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
    },

    view: {
      window: [
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
    },

    setting: {
      subOptions: [
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
      ],
      options: [
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
    },
  }));
};

export const concatMenuBarData = (
  menuBarContents: MaybeRef<MaybeComputedMenuBarContent>[],
): Record<keyof MenuBarContent, MenuItemData[]> => {
  const indexItems = Object.fromEntries(
    Object.entries(menuItemStructure).map(([key, value]) => [
      key as keyof MenuBarCategories,
      Object.fromEntries(value.map((item) => [item, []])),
    ]),
  ) as {
    [K in MenuBarCategories]: Record<
      keyof NonNullable<MenuBarContent>[K],
      MenuItemData[]
    >;
  };

  for (const menuBarContent of unref(menuBarContents)) {
    for (const key in unref(menuBarContent)) {
      const root = key as MenuBarCategories;
      const items = unref(unref(menuBarContent)[root]);
      if (items) {
        for (const itemKey in items) {
          // @ts-expect-error 型パズルが大変なので手動で型を合わせる
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const item = items[itemKey];
          if (item) {
            // @ts-expect-error 型パズルが大変なので手動で型を合わせる
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            indexItems[root][itemKey].push(...item);
          }
        }
      }
    }
  }

  const result = Object.fromEntries(
    Object.entries(menuItemStructure).map(([key, value]) => [
      key,
      flatWithSeparator(
        (
          value.map(
            // @ts-expect-error 型パズルが大変なので手動で型を合わせる
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            (item) => indexItems[key as MenuBarCategories][item],
          ) as MenuItemData[][]
        ).filter((x) => x.length > 0),
        { type: "separator" },
      ),
    ]),
  ) as Record<keyof MenuBarContent, MenuItemData[]>;

  return result;
};
