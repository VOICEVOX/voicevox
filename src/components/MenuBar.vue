<template>
  <q-bar class="bg-white q-pa-none">
    <menu-button
      v-for="(root, i) of menudata"
      :key="i"
      :menudata="root"
      :disable="uiLocked"
      v-model:selected="subMenuOpenFlags[i]"
      @mouseover="reassignSubMenuOpen(i)"
    />
    <q-space></q-space>
    <div id="windowTitle">VOICEVOX</div>
    <q-space></q-space>
    <q-btn
      dense
      flat
      icon="minimize"
      class="windowButtons"
      @click="minimizeWindow()"
    ></q-btn>
    <q-btn
      dense
      flat
      icon="crop_square"
      class="windowButtons"
      @click="maximizeWindow()"
    ></q-btn>
    <q-btn
      dense
      flat
      icon="close"
      class="windowButtons"
      @click="closeWindow()"
    ></q-btn>
  </q-bar>
</template>

<script lang="ts">
import { defineComponent, ref, computed, ComputedRef } from "vue";
import { useQuasar } from "quasar";
import { useStore, SAVE_PROJECT_FILE, LOAD_PROJECT_FILE } from "@/store";
import { UI_LOCKED, SET_USE_GPU } from "@/store/ui";
import { GENERATE_AND_SAVE_ALL_AUDIO, IMPORT_FROM_FILE } from "@/store/audio";
import MenuButton from "@/components/MenuButton.vue";

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
  },

  setup() {
    const store = useStore();
    const $q = useQuasar();

    const uiLocked = computed(() => store.getters[UI_LOCKED]);

    const changeUseGPU = async (useGpu: boolean) => {
      if (store.state.useGpu === useGpu) return;

      const change = async () => {
        await store.dispatch(SET_USE_GPU, { useGpu });
        $q.dialog({
          title: "エンジンの起動モードを変更しました",
          message: "変更を適用するためにVOICEVOXを再起動してください。",
          ok: {
            flat: true,
            textColor: "secondary",
          },
        });
      };

      $q.loading.show({
        spinnerColor: "primary",
        spinnerSize: 50,
        boxClass: "bg-white text-secondary",
        message: "起動モードを変更中です",
      });
      const isAvailableGPUMode = await window.electron.isAvailableGPUMode();
      $q.loading.hide();
      if (useGpu && !isAvailableGPUMode) {
        $q.dialog({
          title: "対応するGPUデバイスが見つかりません",
          message:
            "GPUモードの利用には、メモリが3GB以上あるNVIDIA製GPUが必要です。<br />" +
            "このままGPUモードに変更するとエンジンエラーが発生する可能性があります。本当に変更しますか？",
          html: true,
          persistent: true,
          focus: "cancel",
          style: {
            width: "90vw",
            maxWidth: "90vw",
          },
          ok: {
            label: "変更する",
            flat: true,
            textColor: "secondary",
          },
          cancel: {
            label: "変更しない",
            flat: true,
            textColor: "secondary",
          },
        }).onOk(change);
      } else change();
    };

    const menudata = ref<MenuItemData[]>([
      {
        type: "root",
        label: "ファイル",
        subMenu: [
          {
            type: "button",
            label: "音声書き出し",
            onClick: () => {
              store.dispatch(GENERATE_AND_SAVE_ALL_AUDIO, {});
            },
          },
          {
            type: "button",
            label: "テキスト読み込み",
            onClick: () => {
              store.dispatch(IMPORT_FROM_FILE, {});
            },
          },
          { type: "separator" },
          {
            type: "button",
            label: "プロジェクト保存",
            onClick: () => {
              store.dispatch(SAVE_PROJECT_FILE, {});
            },
          },
          {
            type: "button",
            label: "プロジェクト読み込み",
            onClick: () => {
              store.dispatch(LOAD_PROJECT_FILE, {});
            },
          },
        ],
      },
      {
        type: "root",
        label: "エンジン",
        subMenu: [
          {
            type: "root",
            label: "起動モード",
            subMenu: [
              {
                type: "checkbox",
                label: "CPU",
                checked: computed(() => !store.state.useGpu),
                onClick: async () => changeUseGPU(false),
              },
              {
                type: "checkbox",
                label: "GPU",
                checked: computed(() => store.state.useGpu),
                onClick: async () => changeUseGPU(true),
              },
            ],
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

    const closeWindow = () => window.electron.closeWindow();
    const minimizeWindow = () => window.electron.minimizeWindow();
    const maximizeWindow = () => {
      window.electron.maximizeWindow();
    };

    return {
      uiLocked,
      subMenuOpenFlags,
      reassignSubMenuOpen,
      menudata,
      closeWindow,
      minimizeWindow,
      maximizeWindow,
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
.windowButtons {
  -webkit-app-region: no-drag;
}
</style>
