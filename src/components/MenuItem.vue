<template>
  <q-separator v-if="menudata.type === 'separator'" />
  <q-item
    v-else-if="menudata.type === 'root'"
    dense
    :class="selected && 'active-menu'"
  >
    <q-item-section>{{ menudata.label }}</q-item-section>

    <q-item-section side>
      <q-icon name="keyboard_arrow_right" />
    </q-item-section>

    <q-menu
      anchor="top end"
      transition-show="none"
      transition-hide="none"
      v-model="selectedComputed"
    >
      <menu-item
        v-for="(menu, i) of menudata.subMenu"
        :key="i"
        :menudata="menu"
        v-model:selected="subMenuOpenFlags[i]"
        @mouseover="reassignSubMenuOpen(i)"
      />
    </q-menu>
  </q-item>
  <q-item
    v-else
    dense
    clickable
    v-ripple
    v-close-popup
    @click="menudata.onClick"
  >
    <q-item-section v-if="menudata.type === 'checkbox'" side class="q-pr-sm">
      <q-icon v-if="menudata.checked" name="check" />
      <q-icon v-else />
    </q-item-section>

    <q-item-section>{{ menudata.label }}</q-item-section>
  </q-item>
</template>

<script lang="ts">
import { defineComponent, ref, PropType, computed, watch } from "vue";
import type { MenuItemData } from "@/components/MenuBar.vue";

export default defineComponent({
  name: "MenuItem",

  props: {
    selected: {
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

      const subMenuOpenFlags = ref(
        [...Array(props.menudata.subMenu.length)].map(() => false)
      );

      const reassignSubMenuOpen = (i: number) => {
        if (subMenuOpenFlags.value[i]) return;
        if (props.menudata.type !== "root") return;

        const len = props.menudata.subMenu.length;
        const arr = [...Array(len)].map(() => false);
        arr[i] = true;

        subMenuOpenFlags.value = arr;
      };

      watch(
        () => props.selected,
        () => {
          // 何もしないと自分の選択状態が変わっても子の選択状態は変わらないため、
          // 選択状態でなくなった時に子の選択状態をリセットします
          if (props.menudata.type === "root" && !props.selected) {
            const len = props.menudata.subMenu.length;
            subMenuOpenFlags.value = [...Array(len)].map(() => false);
          }
        }
      );

      return {
        selectedComputed,
        subMenuOpenFlags,
        reassignSubMenuOpen,
      };
    }
  },
});
</script>
