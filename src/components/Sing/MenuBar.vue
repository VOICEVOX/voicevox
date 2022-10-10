<template>
  <q-bar class="bg-background q-pa-none relative-position">
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
  </q-bar>
</template>

<script lang="ts">
import { defineComponent, ref, computed, ComputedRef, watch } from "vue";
import { useStore } from "@/store";
import MenuButton from "@/components/MenuButton.vue";
import { useQuasar } from "quasar";
import { HotkeyAction, HotkeyReturnType } from "@/type/preload";
import { setHotkeyFunctions } from "@/store/setting";
import { base64ImageToUri } from "@/helpers/imageHelper";

type SingMenuItemBase<T extends string> = {
  type: T;
  label?: string;
};

export type MenuItemSeparator = SingMenuItemBase<"separator">;

export type MenuItemRoot = SingMenuItemBase<"root"> & {
  onClick: () => void;
  subMenu: MenuItemData[];
  icon?: string;
};

export type MenuItemButton = SingMenuItemBase<"button"> & {
  onClick: () => void;
  icon?: string;
};

export type MenuItemCheckbox = SingMenuItemBase<"checkbox"> & {
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
  name: "SingMenuBar",

  components: {
    MenuButton,
  },

  setup() {
    const store = useStore();
    const $q = useQuasar();
    const currentVersion = ref("");
    window.electron.getAppInfos().then((obj) => {
      currentVersion.value = obj.version;
    });
    const isFullscreen = computed(() => store.getters.IS_FULLSCREEN);
    const menubarLocked = false; // computed(() => store.getters.IS_SING_MENUBAR_LOCKED);

    const createNewSingProject = async () => {
      return null;
      // await store.dispatch("CREATE_NEW_SING_PROJECT", {});
    };

    const openSingProject = async () => {
      return null;
      // await store.dispatch("OPEN_SING_PROJECT", {});
    };

    const saveSingProject = async () => {
      return null;
      // await store.dispatch("SAVE_SING_PROJECT", {});
    };

    const saveAsSingProject = async () => {
      return null;
      // await store.dispatch("SAVE_AS_SING_PROJECT", {});
    };

    const importMidiFile = async () => {
      return null;
      // await store.dispatch("IMPORT_MIDI_FILE", {});
    };

    const importMusicXMLFile = async () => {
      return null;
      // await store.dispatch("IMPORT_MUSICXML_FILE", {});
    };

    const exportSingDataAsWaveFile = async () => {
      return null;
      // await store.dispatch("EXPORT_SING_DATA_AS_WAVE_FILE", {});
    };

    const openHelpDialog = () => {
      store.dispatch("IS_HELP_DIALOG_OPEN", {
        isHelpDialogOpen: true,
      });
    };

    const closeAllDialog = () => {
      return null;
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
            label: "新規",
            onClick: () => {
              createNewSingProject();
            },
          },
          {
            type: "button",
            label: "開く",
            onClick: () => {
              openSingProject();
            },
          },
          {
            type: "button",
            label: "保存",
            onClick: () => {
              saveSingProject();
            },
          },
          {
            type: "button",
            label: "別名で保存",
            onClick: () => {
              saveAsSingProject();
            },
          },
          { type: "separator" },
          {
            type: "button",
            label: "MIDI読み込み",
            onClick: () => {
              importMidiFile();
            },
          },
          {
            type: "button",
            label: "MusicXML読み込み",
            onClick: () => {
              importMusicXMLFile();
            },
          },
          { type: "separator" },
          {
            type: "button",
            label: "音声を出力",
            onClick: () => {
              exportSingDataAsWaveFile();
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
      // NOTE: 初期設定なし
      // ["新規", createNewSingProject],
    ]);

    setHotkeyFunctions(hotkeyMap);

    return {
      currentVersion,
      isFullscreen,
      menubarLocked,
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
  align-items: center;
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
