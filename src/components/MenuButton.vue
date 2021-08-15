<template>
  <q-badge
    v-if="disable"
    transparent
    color="transparent"
    text-color="secondary"
    class="full-height cursor-not-allowed no-border-radius menu-disable"
    >{{ menudata.label }}</q-badge
  >
  <q-badge
    v-else
    text-color="secondary"
    class="full-height cursor-pointer no-border-radius"
    :class="selected ? 'active-menu' : 'bg-transparent'"
  >
    {{ menudata.label }}
    <q-menu
      v-if="menudata.subMenu"
      transition-show="none"
      transition-hide="none"
      v-model="selectedComputed"
    >
      <q-list dense>
        <menu-item
          v-for="(menu, i) of menudata.subMenu"
          :key="i"
          v-model:selected="isMenuOpen[i]"
          :menudata="menu"
          @mouseover="menuBtnOnMouseOver(i)"
        />
      </q-list>
    </q-menu>
  </q-badge>
</template>

<script lang="ts">
import { defineComponent, computed, ref, PropType, watch } from "vue";
import MenuItem from "@/components/MenuItem.vue";
import { MenuItemData } from "@/components/MenuBar.vue";

export default defineComponent({
  name: "MenuButton",

  components: {
    MenuItem,
  },

  props: {
    selected: {
      type: Boolean,
      required: true,
    },
    disable: {
      type: Boolean,
      required: false,
    },
    menudata: {
      type: Object as PropType<MenuItemData>,
      required: true,
    },
  },

  setup(props, { emit }) {
    if (props.menudata.type === "root") {
      const selectedComputed = computed({
        get: () => props.selected,
        set: (val) => emit("update:selected", val),
      });

      const isMenuOpen = ref(
        [...Array(props.menudata.subMenu.length)].map(() => false)
      );

      const menuBtnOnMouseOver = (i: number) => {
        if (isMenuOpen.value[i]) return;
        if (props.menudata.type !== "root") return;

        const len = props.menudata.subMenu.length;
        const arr = [...Array(len)].map(() => false);
        arr[i] = true;

        isMenuOpen.value = arr;
      };

      watch(
        () => props.selected,
        () => {
          if (props.menudata.type === "root" && !props.selected) {
            const len = props.menudata.subMenu.length;
            isMenuOpen.value = [...Array(len)].map(() => false);
          }
        }
      );

      return {
        selectedComputed,
        isMenuOpen,
        menuBtnOnMouseOver,
      };
    }
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;

.q-badge {
  font-size: 0.8rem !important;
  &:not(.menu-disable):hover {
    background-color: rgba(global.$primary, 0.3) !important;
  }
}
</style>
