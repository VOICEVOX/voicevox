<template>
  <q-menu touch-position context-menu>
    <q-list dense>
      <q-item v-if="slots.default" dense class="bg-background">
        <q-item-section>
          <slot></slot>
        </q-item-section>
      </q-item>
      <menu-item
        v-if="header"
        :key="1"
        :menudata="separator"
        color="primary-light"
      ></menu-item>
      <menu-item
        v-for="(menu, index) of menudata"
        :key="index + (header ? 2 : 0)"
        :menudata="menu"
        :disable="
          uiLocked && menu.type !== 'separator' && menu.disableWhenUiLocked
        "
      >
      </menu-item>
    </q-list>
  </q-menu>
</template>

<script setup lang="ts">
import { computed, useSlots } from "vue";
import MenuItem from "@/components/MenuItem.vue";
import { MenuItemButton, MenuItemSeparator } from "@/components/MenuBar.vue";
import { useStore } from "@/store";
defineProps<{
  header?: boolean;
  menudata: ContextMenuItemData[];
}>();

const store = useStore();
const slots = useSlots();
const uiLocked = computed(() => store.getters.UI_LOCKED);

const separator: MenuItemSeparator = { type: "separator" };

export type ContextMenuItemData = MenuItemSeparator | MenuItemButton;
</script>

<style lang="scss" scoped></style>
