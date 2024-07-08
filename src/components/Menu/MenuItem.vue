<template>
  <QSeparator v-if="menudata.type === 'separator'" class="bg-surface" />
  <QItem
    v-else-if="menudata.type === 'root'"
    class="bg-background"
    clickable
    dense
    :disable="menudata.disabled"
    :class="selected && 'active-menu'"
    @click="menudata.onClick"
  >
    <QItemSection v-if="menudata.icon" side class="q-py-2">
      <img :src="menudata.icon" class="engine-icon" />
    </QItemSection>

    <QItemSection>{{ menudata.label }}</QItemSection>
    <QItemSection
      v-if="menudata.label != undefined && getMenuBarHotkey(menudata.label)"
      side
    >
      {{ getMenuBarHotkey(menudata.label) }}
    </QItemSection>

    <QItemSection side>
      <QIcon name="keyboard_arrow_right" />
    </QItemSection>

    <QMenu
      v-model="selectedComputed"
      anchor="top end"
      transitionShow="none"
      transitionHide="none"
      :target="!uiLocked"
    >
      <MenuItem
        v-for="(menu, i) of menudata.subMenu"
        :key="i"
        v-model:selected="subMenuOpenFlags[i]"
        :menudata="menu"
        @mouseover="reassignSubMenuOpen(i)"
      />
    </QMenu>
  </QItem>
  <QItem
    v-else
    v-ripple
    v-close-popup
    dense
    clickable
    class="bg-background"
    :disable="menudata.disabled"
    @click="menudata.onClick"
  >
    <QItemSection
      v-if="'icon' in menudata && menudata.icon != undefined"
      avatar
    >
      <QAvatar>
        <img :src="menudata.icon" />
      </QAvatar>
    </QItemSection>

    <QItemSection>{{ menudata.label }}</QItemSection>
    <QItemSection
      v-if="menudata.label != undefined && getMenuBarHotkey(menudata.label)"
      side
    >
      {{ getMenuBarHotkey(menudata.label) }}
    </QItemSection>
  </QItem>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { MenuItemData } from "./type";
import { useStore } from "@/store";
import { hotkeyActionNameSchema } from "@/type/preload";
const props = withDefaults(
  defineProps<{
    selected?: boolean;
    menudata: MenuItemData;
  }>(),
  {
    selected: false,
  },
);
const emit = defineEmits<{
  (e: "update:selected", val: boolean): void;
}>();
const store = useStore();
const hotkeySettingsMap = computed(
  () =>
    new Map(
      store.state.hotkeySettings.map((obj) => [obj.action, obj.combination]),
    ),
);
const getMenuBarHotkey = (rawLabel: string) => {
  const label = hotkeyActionNameSchema.safeParse(rawLabel);
  if (!label.success) {
    return "";
  }

  const hotkey = hotkeySettingsMap.value.get(label.data);
  if (hotkey == undefined) {
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
    : [],
);
const reassignSubMenuOpen = (i: number) => {
  if (subMenuOpenFlags.value[i]) return;
  if (props.menudata.type !== "root") return;
  const len = props.menudata.subMenu.length;
  const arr = [...Array(len)].map(() => false);
  arr[i] = true;
  subMenuOpenFlags.value = arr;
};

if (props.menudata.type === "root") {
  watch(
    () => props.selected,
    () => {
      // 何もしないと自分の選択状態が変わっても子の選択状態は変わらないため、
      // 選択状態でなくなった時に子の選択状態をリセットします
      if (props.menudata.type === "root" && !props.selected) {
        const len = props.menudata.subMenu.length;
        subMenuOpenFlags.value = [...Array(len)].map(() => false);
      }
    },
  );
}
</script>

<style lang="scss" scoped>
.engine-icon {
  width: 24px;
  height: 24px;
  border-radius: 2px;
}
</style>
