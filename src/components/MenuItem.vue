<template>
  <q-item
    dense
    clickable
    v-ripple
    v-close-popup="menudata.type === 'button' || menudata.type === 'checkbox'"
    @click="menudata.onClick"
  >
    <q-item-section v-if="menudata.type === 'checkbox'" side class="q-pr-sm">
      <q-icon v-if="menudata.checked" name="check" />
      <q-icon v-else />
    </q-item-section>
    <q-item-section>{{ menudata.label }}</q-item-section>
    <template v-if="menudata.type === 'root'">
      <q-item-section side>
        <q-icon name="keyboard_arrow_right" />
      </q-item-section>
      <q-menu anchor="top end">
        <template v-if="menudata.type === 'root'">
          <menu-item
            v-for="(menu, i) of menudata.subMenu"
            :key="i"
            :menudata="menu"
          />
        </template>
      </q-menu>
    </template>
  </q-item>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import type { MenuItemData } from "@/components/MenuBar.vue";

export default defineComponent({
  name: "MenuItem",

  props: {
    menudata: {
      type: Object as PropType<MenuItemData>,
      required: true,
    },
  },
});
</script>
