<template>
  <QSeparator class="bg-surface" v-if="menudata.type === 'separator'" />
  <QItem
    class="bg-background"
    v-else-if="menudata.type === 'root'"
    clickable
    dense
    :class="selected && 'active-menu'"
  >
    <QItemSection side class="q-py-2" v-if="menudata.icon">
      <img :src="menudata.icon" class="engine-icon" />
    </QItemSection>

    <QItemSection>{{ menudata.label }}</QItemSection>

    <QItemSection side>
      <QIcon name="keyboard_arrow_right" />
    </QItemSection>

    <QMenu
      anchor="top end"
      transition-show="none"
      transition-hide="none"
      v-model="selectedComputed"
      :target="!uiLocked"
    >
      <MenuItem
        v-for="(menu, i) of menudata.subMenu"
        :key="i"
        :menudata="menu"
        v-model:selected="subMenuOpenFlags[i]"
        @mouseover="reassignSubMenuOpen(i)"
      />
    </QMenu>
  </QItem>
  <QItem
    v-else
    dense
    clickable
    v-ripple
    v-close-popup
    class="bg-background"
    @click="menudata.onClick"
  >
    <QItemSection v-if="menudata.type === 'checkbox'" side class="q-pr-sm">
      <QIcon v-if="menudata.checked" name="check" />
      <QIcon v-else />
    </QItemSection>

    <QItemSection avatar v-if="menudata.icon">
      <QAvatar>
        <img :src="menudata.icon" />
      </QAvatar>
    </QItemSection>

    <QItemSection>{{ menudata.label }}</QItemSection>
    <QItemSection side v-if="getMenuBarHotkey(menudata.label)">
      {{ getMenuBarHotkey(menudata.label) }}
    </QItemSection>
  </QItem>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { MenuItemData } from "@/components/MenuBar.vue";
import { useStore } from "@/store";
import { HotkeyAction } from "@/type/preload";

const props =
  defineProps<{
    selected?: boolean;
    menudata: MenuItemData;
  }>();
const emit =
  defineEmits<{
    (e: "update:selected", val: boolean): void;
  }>();

const store = useStore();
const hotkeySettingsMap = computed(
  () =>
    new Map(
      store.state.hotkeySettings.map((obj) => [obj.action, obj.combination])
    )
);
const getMenuBarHotkey = (label: HotkeyAction) => {
  const hotkey = hotkeySettingsMap.value.get(label);
  if (hotkey === undefined) {
    return "";
  } else {
    // Mac の Meta キーは Cmd キーであるため、Meta の表示名を Cmd に置換する
    // Windows PC では Meta キーは Windows キーだが、使用頻度低と考えられるため暫定的に Mac 対応のみを考慮している
    return hotkey.replaceAll(" ", "+").replaceAll("Meta", "Cmd");
  }
};
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
</script>

<style lang="scss" scoped>
.engine-icon {
  width: 24px;
  height: 24px;
  border-radius: 2px;
}
</style>
