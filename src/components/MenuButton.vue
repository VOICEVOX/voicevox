<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { debounce } from "quasar";
import MenuItem from "@/components/MenuItem.vue";
import { MenuItemData } from "@/components/MenuBar.vue";
import { useStore } from "@/store";

const props =
  defineProps<{
    selected: boolean;
    disable: boolean;
    menudata: MenuItemData;
  }>();
const emit =
  defineEmits<{
    (e: "update:selected", value: boolean): void;
  }>();

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);
const selectedComputed = computed({
  get: () => props.selected,
  set: (val) => emit("update:selected", val),
});

const subMenuOpenFlags = ref(
  props.menudata.type === "root"
    ? [...Array(props.menudata.subMenu.length)].map(() => false)
    : []
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
</script>

<template>
  <QBtn
    flat
    text-color="display"
    class="
      full-height
      cursor-pointer
      no-border-radius
      text-no-wrap
      q-py-none q-px-sm
    "
    :class="selected ? 'active-menu' : 'bg-transparent'"
    :disable="disable"
    @click="
      (menudata.type === 'button' || menudata.type === 'root') &&
        menudata.onClick()
    "
  >
    {{ menudata.label }}
    <QMenu
      v-if="menudata.type === 'root'"
      transition-show="none"
      transition-hide="none"
      :fit="true"
      v-model="selectedComputed"
    >
      <QList dense>
        <MenuItem
          v-for="(menu, index) of menudata.subMenu"
          :key="index"
          :menudata="menu"
          :disable="
            menu.type !== 'separator' && uiLocked && menu.disableWhenUiLocked
          "
          v-model:selected="subMenuOpenFlags[index]"
          @mouseenter="reassignSubMenuOpen(index)"
          @mouseleave="reassignSubMenuOpen.cancel()"
        />
      </QList>
    </QMenu>
  </QBtn>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as vars;

.q-btn {
  min-height: 0;
  overflow: hidden;
  :deep(.q-btn__content) {
    display: inline;
    line-height: vars.$menubar-height;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
