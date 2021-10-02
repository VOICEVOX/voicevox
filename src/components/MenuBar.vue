<template>
  <q-bar class="bg-white q-pa-none relative-position">
    <img src="icon.png" class="window-logo" alt="application logo" />
    <menu-button
      v-for="(root, i) of menudata"
      :key="i"
      :menudata="root"
      :disable="uiLocked"
      v-model:selected="subMenuOpenFlags[i]"
      @mouseover="reassignSubMenuOpen(i)"
    />
    <q-space />
    <div v-if="projectName !== undefined" class="window-title">
      {{ projectName + " - VOICEVOX" }}
    </div>
    <div v-else class="window-title">VOICEVOX</div>
    <q-space />
    <title-bar-buttons />
  </q-bar>
</template>

<script lang="ts">
import { defineComponent, ref, computed, ComputedRef, watch } from "vue";
import { useStore } from "@/store";
import { UI_LOCKED } from "@/store/ui";
import {
  SAVE_PROJECT_FILE,
  LOAD_PROJECT_FILE,
  PROJECT_NAME,
  CREATE_NEW_PROJECT,
} from "@/store/project";
import {
  GENERATE_AND_SAVE_ALL_AUDIO,
  IMPORT_FROM_FILE,
  RESTART_ENGINE,
} from "@/store/audio";
import MenuButton from "@/components/MenuButton.vue";
import TitleBarButtons from "@/components/TitleBarButtons.vue";
import { SaveResultObject } from "@/store/type";
import { useQuasar } from "quasar";
import SaveAllResultDialog from "@/components/SaveAllResultDialog.vue";
import { setHotkeyFunctions } from "@/store/setting";
import { HotkeyAction } from "@/type/preload";

type MenuItemBase<T extends string> = {
  type: T;
  label?: string;
};

export type MenuItemSeparator = MenuItemBase<"separator">;

export type MenuItemRoot = MenuItemBase<"root"> & {
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
    MenuButton,
    TitleBarButtons,
  },

  setup() {
    const store = useStore();
    const $q = useQuasar();

    const uiLocked = computed(() => store.getters[UI_LOCKED]);
    const projectName = computed(() => store.getters[PROJECT_NAME]);

    const createNewProject = async () => {
      await store.dispatch(CREATE_NEW_PROJECT, {});
    };

    const generateAndSaveAllAudio = async () => {
      const result: Array<SaveResultObject> = await store.dispatch(
        GENERATE_AND_SAVE_ALL_AUDIO,
        {
          encoding: store.state.savingSetting.fileEncoding,
        }
      );

      let successArray: Array<string | undefined> = [];
      let writeErrorArray: Array<string | undefined> = [];
      let engineErrorArray: Array<string | undefined> = [];
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
    };

    const importTextFile = () => {
      store.dispatch(IMPORT_FROM_FILE, {});
    };

    const saveProject = () => {
      store.dispatch(SAVE_PROJECT_FILE, { overwrite: true });
    };

    const saveProjectAs = () => {
      store.dispatch(SAVE_PROJECT_FILE, {});
    };

    const importProject = () => {
      store.dispatch(LOAD_PROJECT_FILE, {});
    };

    const menudata = ref<MenuItemData[]>([
      {
        type: "root",
        label: "ファイル",
        subMenu: [
          {
            type: "button",
            label: "新規プロジェクト",
            onClick: createNewProject,
          },
          {
            type: "button",
            label: "音声書き出し",
            onClick: generateAndSaveAllAudio,
          },
          {
            type: "button",
            label: "テキスト読み込む",
            onClick: importTextFile,
          },
          { type: "separator" },
          {
            type: "button",
            label: "プロジェクトを上書き保存",
            onClick: saveProject,
          },
          {
            type: "button",
            label: "プロジェクトを名前を付けて保存",
            onClick: saveProjectAs,
          },
          {
            type: "button",
            label: "プロジェクト読み込み",
            onClick: importProject,
          },
        ],
      },
      {
        type: "root",
        label: "エンジン",
        subMenu: [
          {
            type: "button",
            label: "再起動",
            onClick: () => store.dispatch(RESTART_ENGINE),
          },
        ],
      },
    ]);

    const subMenuOpenFlags = ref(
      [...Array(menudata.value.length)].map(() => false)
    );

    const reassignSubMenuOpen = (i: number) => {
      if (subMenuOpenFlags.value[i]) return;
      if (subMenuOpenFlags.value.find((x) => x)) {
        const arr = [...Array(menudata.value.length)].map(() => false);
        arr[i] = true;
        subMenuOpenFlags.value = arr;
      }
    };

    const hotkeyActions = [
      createNewProject,
      generateAndSaveAllAudio,
      importTextFile,
      saveProject,
      saveProjectAs,
      importProject,
    ];

    const hotkeyActionKeys: HotkeyAction[] = [
      "新規プロジェクト",
      "音声書き出し",
      "テキスト読み込む",
      "プロジェクトを上書き保存",
      "プロジェクトを名前を付けて保存",
      "プロジェクト読み込み",
    ];

    setHotkeyFunctions(hotkeyActionKeys, hotkeyActions);

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
      projectName,
      subMenuOpenFlags,
      reassignSubMenuOpen,
      menudata,
    };
  },
});
</script>

<style lang="scss">
@use '@/styles' as global;

.active-menu {
  background-color: rgba(global.$primary, 0.3) !important;
}
</style>

<style lang="scss" scoped>
@use '@/styles' as global;

.q-bar {
  min-height: global.$menubar-height;
  -webkit-app-region: drag;
  > .q-badge {
    margin-left: 0;
    -webkit-app-region: no-drag;
  }
}

.window-logo {
  height: global.$menubar-height;
}

.window-title {
  height: global.$menubar-height;
  margin-right: 10%;
  text-overflow: ellipsis;
  overflow: hidden;
}
</style>
