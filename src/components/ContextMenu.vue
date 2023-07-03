<template>
  <q-menu touch-position context-menu>
    <q-list dense>
      <menu-item
        v-for="(menu, index) of menudata"
        :key="index"
        :menudata="menu"
        :disable="
          uiLocked && menu.type !== 'separator' && menu.disableWhenUiLocked
        "
      ></menu-item>
    </q-list>
  </q-menu>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MenuItem from "@/components/MenuItem.vue";
import { MenuItemButton, MenuItemSeparator } from "@/components/MenuBar.vue";
import { useStore } from "@/store";

defineProps<{
  menudata: ContextMenuItemData[];
}>();

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);

export type ContextMenuItemData = MenuItemSeparator | MenuItemButton;
</script>

<style lang="scss" scoped></style>
