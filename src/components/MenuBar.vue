<template>
  <q-bar class="bg-background q-pa-none relative-position">
    <img src="icon.png" class="window-logo" alt="application logo" />
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
import MenuButton from "@/components/MenuButton.vue";
import TitleBarButtons from "@/components/TitleBarButtons.vue";
import { useQuasar } from "quasar";
import SaveAllResultDialog from "@/components/SaveAllResultDialog.vue";
import { HotkeyAction, HotkeyReturnType } from "@/type/preload";
import { setHotkeyFunctions } from "@/store/setting";
import { SaveResultObject } from "@/store/type";
import { MessageSchema } from "@/i18n";
import { useI18n } from "vue-i18n";

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
  hotkey: boolean;
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
          $q.dialog({
            component: SaveAllResultDialog,
            componentProps: {
              successArray: successArray,
              writeErrorArray: writeErrorArray,
              engineErrorArray: engineErrorArray,
            },
          });
        }
      }
    };

    const { t } = useI18n<{ message: MessageSchema }>({
      useScope: "global",
    });

    const generateAndSaveOneAudio = async () => {
      if (uiLocked.value) return;

      const activeAudioKey = store.getters.ACTIVE_AUDIO_KEY;
      if (activeAudioKey == undefined) {
        $q.dialog({
          title: t("dialogs.cell_not_found.title"),
          message: t("dialogs.cell_not_found.msg"),
          ok: {
            label: t("dialogs.cell_not_found.close"),
            flat: true,
            textColor: "secondary",
          },
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
          msg = t("dialogs.export_failed.write_error_msg");
          break;
        case "ENGINE_ERROR":
          msg = t("dialogs.export_failed.engine_error_msg");
          break;
      }

      $q.dialog({
        title: t("dialogs.export_failed.title"),
        message: msg,
        ok: {
          label: t("dialogs.export_failed.close"),
          flat: true,
          textColor: "secondary",
        },
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
        label: t("menu_bar.file.label"),
        onClick: () => {
          closeAllDialog();
        },
        subMenu: [
          {
            type: "button",
            label: "newProj",
            onClick: createNewProject,
            hotkey: true,
          },
          {
            type: "button",
            label: "exportAudio",
            onClick: () => {
              generateAndSaveAllAudio();
            },
            hotkey: true,
          },
          {
            type: "button",
            label: "exportAllAudio",
            onClick: () => {
              generateAndSaveOneAudio();
            },
            hotkey: true,
          },
          {
            type: "button",
            label: "importText",
            onClick: () => {
              importTextFile();
            },
            hotkey: true,
          },
          { type: "separator" },
          {
            type: "button",
            label: "saveProj",
            onClick: () => {
              saveProject();
            },
            hotkey: true,
          },
          {
            type: "button",
            label: "saveProjAs",
            onClick: () => {
              saveProjectAs();
            },
            hotkey: true,
          },
          {
            type: "button",
            label: "openProj",
            onClick: () => {
              importProject();
            },
            hotkey: true,
          },
        ],
      },
      {
        type: "root",
        label: t("menu_bar.engine.label"),
        onClick: () => {
          closeAllDialog();
        },
        subMenu: [
          {
            type: "button",
            label: t("menu_bar.engine.restart"),
            onClick: () => {
              store.dispatch("RESTART_ENGINE");
            },
            hotkey: false,
          },
        ],
      },
      {
        type: "root",
        label: t("menu_bar.setting.label"),
        onClick: () => {
          closeAllDialog();
        },
        subMenu: [
          {
            type: "button",
            label: t("menu_bar.setting.hotkeys"),
            onClick() {
              store.dispatch("IS_HOTKEY_SETTING_DIALOG_OPEN", {
                isHotkeySettingDialogOpen: true,
              });
            },
            hotkey: false,
          },
          {
            type: "button",
            label: t("menu_bar.setting.default_styles"),
            onClick() {
              store.dispatch("IS_DEFAULT_STYLE_SELECT_DIALOG_OPEN", {
                isDefaultStyleSelectDialogOpen: true,
              });
            },
            hotkey: false,
          },
          { type: "separator" },
          {
            type: "button",
            label: t("menu_bar.setting.general"),
            onClick() {
              store.dispatch("IS_SETTING_DIALOG_OPEN", {
                isSettingDialogOpen: true,
              });
            },
            hotkey: false,
          },
        ],
      },
      {
        type: "button",
        label: t("menu_bar.help.label"),
        onClick: () => {
          if (store.state.isHelpDialogOpen) closeAllDialog();
          else {
            closeAllDialog();
            openHelpDialog();
          }
        },
        hotkey: true,
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
      ["newProj", createNewProject],
      ["exportAllAudio", generateAndSaveAllAudio],
      ["exportAudio", generateAndSaveOneAudio],
      ["importText", importTextFile],
      ["saveProj", saveProject],
      ["saveProjAs", saveProjectAs],
      ["openProj", importProject],
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
      t,
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
