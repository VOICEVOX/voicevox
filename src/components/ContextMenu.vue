<template>
  <q-menu touch-position context-menu>
    <q-list dense>
      <q-item v-if="slots.header" dense class="bg-background">
        <q-item-section>
          <slot name="header"></slot>
        </q-item-section>
      </q-item>
      <menu-item
        v-if="slots.header"
        :key="1"
        :menudata="{ type: 'separator' }"
      ></menu-item>
      <menu-item
        v-for="(menu, index) of menudata"
        :key="index + (slots.default ? 2 : 0)"
        :menudata="menu"
        :disable="
          (menu.type !== 'separator' && menu.disabled) ||
          (uiLocked && menu.type !== 'separator' && menu.disableWhenUiLocked)
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
  menudata: ContextMenuItemData[];
}>();

const store = useStore();
const slots = useSlots();
const uiLocked = computed(() => store.getters.UI_LOCKED);

export type ContextMenuItemData = MenuItemSeparator | MenuItemButton;
</script>

<style lang="scss" scoped></style>
