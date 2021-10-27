<template>
  <q-btn
    flat
    text-color="secondary"
    class="
      full-height
      cursor-pointer
      no-border-radius
      text-no-wrap
      q-py-none q-px-sm
    "
    :class="selected ? 'active-menu' : 'bg-transparent'"
    :disable="disable"
    @click="menudata.type === 'button' && menudata.onClick()"
  >
    {{ menudata.label }}
    <q-menu
      v-if="menudata.subMenu"
      transition-show="none"
      transition-hide="none"
      :fit="true"
      v-model="selectedComputed"
    >
      <q-list dense>
        <menu-item
          v-for="(menu, index) of menudata.subMenu"
          :key="index"
          :menudata="menu"
          v-model:selected="subMenuOpenFlags[index]"
          @mouseenter="reassignSubMenuOpen(index)"
          @mouseleave="reassignSubMenuOpen.cancel()"
        />
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script lang="ts">
import { defineComponent, computed, ref, PropType, watch } from "vue";
import { debounce } from "quasar";
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

      const subMenuOpenFlags = ref(
        [...Array(props.menudata.subMenu.length)].map(() => false)
      );

      const reassignSubMenuOpen = debounce((idx: number) => {
        if (subMenuOpenFlags.value[idx]) return;
        if (props.menudata.type !== "root") return;

        const len = props.menudata.subMenu.length;
        const arr = [...Array(len)].map(() => false);
        arr[idx] = true;

        subMenuOpenFlags.value = arr;
      }, 100);

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

<style lang="scss" scoped>
@use '@/styles' as global;

.q-btn {
  min-height: 0;
  overflow: hidden;
  :deep(.q-btn__content) {
    display: inline;
    line-height: global.$menubar-height;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
