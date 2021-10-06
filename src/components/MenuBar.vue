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
import Mousetrap from "mousetrap";
import { useQuasar } from "quasar";
import SaveAllResultDialog from "@/components/SaveAllResultDialog.vue";

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
  shortCut?: string;
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
    const projectName = computed(() => store.getters.PROJECT_NAME);
    const isEdited = computed(() => store.getters.IS_EDITED);

    const menudata = ref<MenuItemData[]>([
      {
        type: "root",
        label: "ファイル",
        subMenu: [
          {
            type: "button",
            label: "新規プロジェクト",
            shortCut: "Ctrl+N",
            onClick: async () => {
              await store.dispatch("CREATE_NEW_PROJECT", {});
            },
          },
          {
            type: "button",
            label: "音声書き出し",
            shortCut: "Ctrl+E",
            onClick: async () => {
              const result = await store.dispatch(
                "GENERATE_AND_SAVE_ALL_AUDIO",
                {
                  encoding: store.state.savingSetting.fileEncoding,
                }
              );

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
            },
          },
          {
            type: "button",
            label: "テキスト読み込み",
            onClick: () => {
              store.dispatch("COMMAND_IMPORT_FROM_FILE", {});
            },
          },
          { type: "separator" },
          {
            type: "button",
            label: "プロジェクトを上書き保存",
            shortCut: "Ctrl+S",
            onClick: () => {
              store.dispatch("SAVE_PROJECT_FILE", { overwrite: true });
            },
          },
          {
            type: "button",
            label: "プロジェクトを名前を付けて保存",
            shortCut: "Ctrl+Shift+S",
            onClick: () => {
              store.dispatch("SAVE_PROJECT_FILE", {});
            },
          },
          {
            type: "button",
            label: "プロジェクト読み込み",
            shortCut: "Ctrl+O",
            onClick: () => {
              store.dispatch("LOAD_PROJECT_FILE", {});
            },
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
            onClick: () => store.dispatch("RESTART_ENGINE"),
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

    // メニューバー中のホットキー有効化
    const _enableHotKey = (items: any) => {
      items.forEach((item: MenuItemData) => {
        if (item.type === "root") {
          _enableHotKey(item.subMenu);
          return;
        }
        if (item.type === "button" && item.shortCut) {
          Mousetrap.bind(item.shortCut.toLowerCase(), () => {
            if (!uiLocked.value) item.onClick();
          });
          return;
        }
      });
    };
    _enableHotKey(menudata.value);

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
      isEdited,
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
