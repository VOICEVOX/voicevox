<template>
  <q-bar class="bg-white q-pa-none">
    <q-btn
      v-for="(root, i) of menudata"
      :key="i"
      dense
      flat
      class="no-border-radius"
      :disable="uiLocked"
    >
      {{ root.label }}
      <q-menu v-if="root.subMenu">
        <q-list dense>
          <menu-item
            v-for="(menu, i) of root.subMenu"
            :key="i"
            :menudata="menu"
          ></menu-item>
        </q-list>
      </q-menu>
    </q-btn>
  </q-bar>
</template>

<script lang="ts">
import { defineComponent, ref, computed, ComputedRef } from "vue";
import { useQuasar } from "quasar";
import { useStore, SAVE_PROJECT_FILE, LOAD_PROJECT_FILE } from "@/store";
import { UI_LOCKED, USE_GPU } from "@/store/ui";
import { GENERATE_AND_SAVE_ALL_AUDIO, IMPORT_FROM_FILE } from "@/store/audio";
import MenuItem from "@/components/MenuItem.vue";

type MenuItemBase<T extends string> = {
  type: T;
  label: string;
};

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

export type MenuItemData = MenuItemRoot | MenuItemButton | MenuItemCheckbox;

export type MenuItemType = MenuItemData["type"];

export default defineComponent({
  name: "MenuBar",

  components: {
    MenuItem,
  },

  setup() {
    const store = useStore();
    const $q = useQuasar();

    const uiLocked = computed(() => store.getters[UI_LOCKED]);

    const changeUseGPU = async (value: boolean) => {
      const beforeValue = store.getters[USE_GPU];
      if (beforeValue === value) return;

      const change = async () => {
        await store.dispatch(USE_GPU, {
          useGPU: await window.electron.useGPU(value),
        });
        $q.dialog({
          title: "エンジンの起動モードを変更しました",
          message: "変更を適用するためにVOICEVOXを再起動してください。",
          persistent: true,
          ok: {
            flat: true,
            textColor: "secondary",
          },
        });
      };

      $q.loading.show({ spinnerColor: "primary" });
      const isAvailableGPUMode = await window.electron.isAvailableGPUMode();
      $q.loading.hide();
      if (value && !isAvailableGPUMode) {
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
                checked: computed(() => !store.getters[USE_GPU]),
                onClick: async () => changeUseGPU(false),
              },
              {
                type: "checkbox",
                label: "GPU",
                checked: computed(() => store.getters[USE_GPU]),
                onClick: async () => changeUseGPU(true),
              },
            ],
          },
        ],
      },
    ]);

    return {
      uiLocked,
      menudata,
    };
  },
});
</script>
