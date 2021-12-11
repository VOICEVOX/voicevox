<template>
  <q-bar class="bg-background q-pa-none relative-position">
    <min-max-close-buttons v-if="$q.platform.is.mac" />
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
        "VOICEVOX"
      }}
    </div>
    <q-space />
    <title-bar-buttons />
  </q-bar>
</template>

<script lang="ts">
import { defineComponent, ref, computed, ComputedRef, watch } from "vue";
import { useStore } from "@/store";
import MinMaxCloseButtons from "@/components/MinMaxCloseButtons.vue";
import MenuButton from "@/components/MenuButton.vue";
import TitleBarButtons from "@/components/TitleBarButtons.vue";
import { HotkeyAction, HotkeyReturnType } from "@/type/preload";
import { setHotkeyFunctions } from "@/store/setting";
import { SaveResultObject } from "@/store/type";

type MenuItemBase<T extends string> = {
  type: T;
  label?: string;
};

export type MenuItemSeparator = MenuItemBase<"separator">;

export type MenuItemRoot = MenuItemBase<"root"> & {
  onClick: () => void;
  subMenu: MenuItemData[];
};

export type MenuItemButton = MenuItemBase<"button"> & {
  onClick: () => void;
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
    MinMaxCloseButtons,
    MenuButton,
    TitleBarButtons,
  },

  setup() {
    const store = useStore();

    const uiLocked = computed(() => store.getters.UI_LOCKED);
    const menubarLocked = computed(() => store.getters.MENUBAR_LOCKED);
    const projectName = computed(() => store.getters.PROJECT_NAME);
    const isEdited = computed(() => store.getters.IS_EDITED);

    const createNewProject = async () => {
      if (!uiLocked.value) {
        await store.dispatch("CREATE_NEW_PROJECT", {});
      }
    };

    const generateAndSaveAllAudio = async () => {
      if (!uiLocked.value) {
        const result = await store.dispatch("GENERATE_AND_SAVE_ALL_AUDIO", {
          encoding: store.state.savingSetting.fileEncoding,
        });

        let successArray: Array<string | undefined> = [];
        let writeErrorArray: Array<string | undefined> = [];
        let engineErrorArray: Array<string | undefined> = [];
        if (result) {
          for (const item of result) {
            switch (item.result) {
              case "SUCCESS":
                successArray.push(item.path);
                break;
              case "WRITE_ERROR":
                writeErrorArray.push(item.path);
                break;
              case "ENGINE_ERROR":
                engineErrorArray.push(item.path);
                break;
            }
          }
        }

        if (writeErrorArray.length > 0 || engineErrorArray.length > 0) {
          store.dispatch("OPEN_SAVE_ALL_RESULT_DIALOG", {
            successArray,
            writeErrorArray,
            engineErrorArray,
          });
        }
      }
    };

    const generateAndSaveOneAudio = async () => {
      if (uiLocked.value) return;

      const activeAudioKey = store.getters.ACTIVE_AUDIO_KEY;
      if (activeAudioKey == undefined) {
        store.dispatch("OPEN_COMMON_DIALOG", {
          title: "テキスト欄が選択されていません",
          message: "音声を書き出したいテキスト欄を選択してください。",
          okButtonText: "閉じる",
        });
        return;
      }

      const result: SaveResultObject = await store.dispatch(
        "GENERATE_AND_SAVE_AUDIO",
        {
          audioKey: activeAudioKey,
          encoding: store.state.savingSetting.fileEncoding,
        }
      );

      if (result.result === "SUCCESS" || result.result === "CANCELED") return;

      let msg = "";
      switch (result.result) {
        case "WRITE_ERROR":
          msg =
            "書き込みエラーによって失敗しました。空き容量があることや、書き込み権限があることをご確認ください。";
          break;
        case "ENGINE_ERROR":
          msg =
            "エンジンのエラーによって失敗しました。エンジンの再起動をお試しください。";
          break;
      }

      store.dispatch("OPEN_COMMON_DIALOG", {
        title: "書き出しに失敗しました。",
        message: msg,
        okButtonText: "閉じる",
      });
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
    const closeAllDialog = async () => {
      await store.dispatch("CLOSE_ALL_DIALOG");
    };

    const openHelpDialog = () => {
      store.dispatch("OPEN_HELP_DIALOG");
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
            label: "新規プロジェクト",
            onClick: createNewProject,
          },
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
            label: "テキスト読み込み",
            onClick: () => {
              importTextFile();
            },
          },
          { type: "separator" },
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
            label: "再起動",
            onClick: () => {
              store.dispatch("RESTART_ENGINE");
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
              store.dispatch("OPEN_HOTKEY_SETTING_DIALOG");
            },
          },
          {
            type: "button",
            label: "デフォルトスタイル・試聴",
            onClick() {
              store.dispatch("OPEN_DEFAULT_STYLE_SELECT_DIALOG", {
                characterInfos: store.state.characterInfos ?? [],
              });
            },
          },
          { type: "separator" },
          {
            type: "button",
            label: "オプション",
            onClick() {
              store.dispatch("OPEN_SETTING_DIALOG");
            },
          },
        ],
      },
      {
        type: "button",
        label: "ヘルプ",
        onClick: async () => {
          if (store.state.dialogContexts.find((x) => x.dialog === "HELP"))
            await closeAllDialog();
          else {
            await closeAllDialog();
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
      ["テキスト読み込む", importTextFile],
      ["プロジェクトを上書き保存", saveProject],
      ["プロジェクトを名前を付けて保存", saveProjectAs],
      ["プロジェクト読み込み", importProject],
    ]);

    setHotkeyFunctions(hotkeyMap);

    watch(uiLocked, () => {
      // UIのロックが解除された時に再びメニューが開かれてしまうのを防ぐ
      if (uiLocked.value) {
        subMenuOpenFlags.value = [...Array(menudata.value.length)].map(
          () => false
        );
      }
    });

    return {
      uiLocked,
      menubarLocked,
      projectName,
      isEdited,
      subMenuOpenFlags,
      reassignSubMenuOpen,
      menudata,
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
</style>
