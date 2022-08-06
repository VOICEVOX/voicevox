<template>
  <q-bar class="bg-background q-pa-none relative-position">
    <div
      v-if="$q.platform.is.mac && !isFullscreen"
      class="mac-traffic-light-space"
    ></div>
    <img v-else src="icon.png" class="window-logo" alt="application logo" />
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
    <div class="window-title">
      {{
        (isEdited ? "*" : "") +
        (projectName !== undefined ? projectName + " - " : "") +
        "VOICEVOX" +
        (currentVersion ? " - Ver. " + currentVersion + " - " : "") +
        (useGpu ? "GPU" : "CPU")
      }}
    </div>
    <q-space />
    <title-bar-buttons />
  </q-bar>
</template>

<script lang="ts">
import { defineComponent, ref, computed, ComputedRef, watch } from "vue";
import { useStore } from "@/store";
import MenuButton from "@/components/MenuButton.vue";
import TitleBarButtons from "@/components/TitleBarButtons.vue";
import { useQuasar } from "quasar";
import { HotkeyAction, HotkeyReturnType } from "@/type/preload";
import { setHotkeyFunctions } from "@/store/setting";
import {
  generateAndConnectAndSaveAudioWithDialog,
  generateAndSaveAllAudioWithDialog,
  generateAndSaveOneAudioWithDialog,
  connectAndExportTextWithDialog,
} from "@/components/Dialog";

type MenuItemBase<T extends string> = {
  type: T;
  label?: string;
};

export type MenuItemSeparator = MenuItemBase<"separator">;

export type MenuItemRoot = MenuItemBase<"root"> & {
  onClick: () => void;
  subMenu: MenuItemData[];
  icon?: string;
};

export type MenuItemButton = MenuItemBase<"button"> & {
  onClick: () => void;
  icon?: string;
};

export type MenuItemCheckbox = MenuItemBase<"checkbox"> & {
  checked: ComputedRef<boolean>;
  onClick: () => void;
};

export type MenuItemData =
  | MenuItemSeparator
  | MenuItemRoot
  | MenuItemButton
  | MenuItemCheckbox;

export type MenuItemType = MenuItemData["type"];

export default defineComponent({
  name: "MenuBar",

  components: {
    MenuButton,
    TitleBarButtons,
  },

  setup() {
    const store = useStore();
    const $q = useQuasar();
    const currentVersion = ref("");
    window.electron.getAppInfos().then((obj) => {
      currentVersion.value = obj.version;
    });
    const uiLocked = computed(() => store.getters.UI_LOCKED);
    const menubarLocked = computed(() => store.getters.MENUBAR_LOCKED);
    const projectName = computed(() => store.getters.PROJECT_NAME);
    const useGpu = computed(() => store.state.useGpu);
    const isEdited = computed(() => store.getters.IS_EDITED);
    const isFullscreen = computed(() => store.getters.IS_FULLSCREEN);
    const engineInfos = computed(() => store.state.engineInfos);

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
      store.dispatch("IS_SETTING_DIALOG_OPEN", {
        isSettingDialogOpen: false,
      });
      store.dispatch("IS_HELP_DIALOG_OPEN", {
        isHelpDialogOpen: false,
      });
      store.dispatch("IS_HOTKEY_SETTING_DIALOG_OPEN", {
        isHotkeySettingDialogOpen: false,
      });
      store.dispatch("IS_TOOLBAR_SETTING_DIALOG_OPEN", {
        isToolbarSettingDialogOpen: false,
      });
      store.dispatch("IS_CHARACTER_ORDER_DIALOG_OPEN", {
        isCharacterOrderDialogOpen: false,
      });
      store.dispatch("IS_DEFAULT_STYLE_SELECT_DIALOG_OPEN", {
        isDefaultStyleSelectDialogOpen: false,
      });
    };

    const openHelpDialog = () => {
      store.dispatch("IS_HELP_DIALOG_OPEN", {
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
        subMenu: [
          {
            type: "button",
            label: "音声書き出し",
            onClick: () => {
              generateAndSaveAllAudio();
            },
          },
          {
            type: "button",
            label: "一つだけ書き出し",
            onClick: () => {
              generateAndSaveOneAudio();
            },
          },
          {
            type: "button",
            label: "音声を繋げて書き出し",
            onClick: () => {
              generateAndConnectAndSaveAllAudio();
            },
          },
          { type: "separator" },
          {
            type: "button",
            label: "テキストを繋げて書き出し",
            onClick: () => {
              connectAndExportText();
            },
          },
          {
            type: "button",
            label: "テキスト読み込み",
            onClick: () => {
              importTextFile();
            },
          },
          { type: "separator" },
          {
            type: "button",
            label: "新規プロジェクト",
            onClick: createNewProject,
          },
          {
            type: "button",
            label: "プロジェクトを上書き保存",
            onClick: () => {
              saveProject();
            },
          },
          {
            type: "button",
            label: "プロジェクトを名前を付けて保存",
            onClick: () => {
              saveProjectAs();
            },
          },
          {
            type: "button",
            label: "プロジェクト読み込み",
            onClick: () => {
              importProject();
            },
          },
        ],
      },
      {
        type: "root",
        label: "エンジン",
        onClick: () => {
          closeAllDialog();
        },
        subMenu: [
          {
            type: "button",
            label: "全てのエンジンを再起動",
            onClick: () => {
              store.dispatch("RESTART_ENGINE_ALL");
            },
          },
        ],
      },
      {
        type: "root",
        label: "設定",
        onClick: () => {
          closeAllDialog();
        },
        subMenu: [
          {
            type: "button",
            label: "キー割り当て",
            onClick() {
              store.dispatch("IS_HOTKEY_SETTING_DIALOG_OPEN", {
                isHotkeySettingDialogOpen: true,
              });
            },
          },
          {
            type: "button",
            label: "ツールバーのカスタマイズ",
            onClick() {
              store.dispatch("IS_TOOLBAR_SETTING_DIALOG_OPEN", {
                isToolbarSettingDialogOpen: true,
              });
            },
          },
          {
            type: "button",
            label: "キャラクター並び替え・試聴",
            onClick() {
              store.dispatch("IS_CHARACTER_ORDER_DIALOG_OPEN", {
                isCharacterOrderDialogOpen: true,
              });
            },
          },
          {
            type: "button",
            label: "デフォルトスタイル",
            onClick() {
              store.dispatch("IS_DEFAULT_STYLE_SELECT_DIALOG_OPEN", {
                isDefaultStyleSelectDialogOpen: true,
              });
            },
          },
          {
            type: "button",
            label: "読み方＆アクセント辞書",
            onClick() {
              store.dispatch("IS_DICTIONARY_MANAGE_DIALOG_OPEN", {
                isDictionaryManageDialogOpen: true,
              });
            },
          },
          { type: "separator" },
          {
            type: "button",
            label: "オプション",
            onClick() {
              store.dispatch("IS_SETTING_DIALOG_OPEN", {
                isSettingDialogOpen: true,
              });
            },
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
          engineInfo.path && {
            type: "button",
            label: "フォルダを開く",
            onClick: () => {
              store.dispatch("OPEN_ENGINE_DIRECTORY", {
                engineId: engineInfo.uuid,
              });
            },
          },
          {
            type: "button",
            label: "再起動",
            onClick: () => {
              store.dispatch("RESTART_ENGINE", {
                engineId: engineInfo.uuid,
              });
            },
          },
        ].filter((x) => x) as MenuItemData[];
      } else {
        engineMenu.subMenu = [
          ...Object.values(engineInfos.value).map(
            (engineInfo) =>
              ({
                type: "root",
                label: engineInfo.name,
                icon: engineInfo.iconData,
                subMenu: [
                  engineInfo.path && {
                    type: "button",
                    label: "フォルダを開く",
                    onClick: () => {
                      store.dispatch("OPEN_ENGINE_DIRECTORY", {
                        engineId: engineInfo.uuid,
                      });
                    },
                  },
                  {
                    type: "button",
                    label: "再起動",
                    onClick: () => {
                      store.dispatch("RESTART_ENGINE", {
                        engineId: engineInfo.uuid,
                      });
                    },
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
              store.dispatch("RESTART_ENGINE_ALL");
            },
          },
        ];
      }
    }
    watch(engineInfos, updateEngines, { immediate: true }); // engineInfosを見て動的に更新できるようにする

    watch(uiLocked, () => {
      // UIのロックが解除された時に再びメニューが開かれてしまうのを防ぐ
      if (uiLocked.value) {
        subMenuOpenFlags.value = [...Array(menudata.value.length)].map(
          () => false
        );
      }
    });

    return {
      currentVersion,
      uiLocked,
      menubarLocked,
      projectName,
      isEdited,
      isFullscreen,
      subMenuOpenFlags,
      reassignSubMenuOpen,
      menudata,
      useGpu,
    };
  },
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
