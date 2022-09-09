<template>
  <q-separator class="bg-surface" v-if="menudata.type === 'separator'" />
  <q-item
    class="bg-background"
    v-else-if="menudata.type === 'root'"
    clickable
    dense
    :class="selected && 'active-menu'"
  >
    <q-item-section side class="q-py-2" v-if="menudata.icon">
      <img :src="menudata.icon" class="engine-icon" />
    </q-item-section>

    <q-item-section>{{ menudata.label }}</q-item-section>

    <q-item-section side>
      <q-icon name="keyboard_arrow_right" />
    </q-item-section>

    <q-menu
      anchor="top end"
      transition-show="none"
      transition-hide="none"
      v-model="selectedComputed"
      :target="!uiLocked"
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
    class="bg-background"
    @click="menudata.onClick"
  >
    <q-item-section v-if="menudata.type === 'checkbox'" side class="q-pr-sm">
      <q-icon v-if="menudata.checked" name="check" />
      <q-icon v-else />
    </q-item-section>

    <q-item-section avatar v-if="menudata.icon">
      <q-avatar>
        <img :src="menudata.icon" />
      </q-avatar>
    </q-item-section>

    <q-item-section>{{ menudata.label }}</q-item-section>
    <q-item-section side v-if="getMenuBarHotkey(menudata.label)">
      {{ getMenuBarHotkey(menudata.label) }}
    </q-item-section>
  </q-item>
</template>

<style lang="scss" scoped>
.engine-icon {
  width: 24px;
  height: 24px;
  border-radius: 2px;
}
</style>

<script lang="ts">
import { defineComponent, ref, PropType, computed, watch } from "vue";
import type { MenuItemData } from "@/components/MenuBar.vue";
import { useStore } from "@/store";
import { HotkeyAction } from "@/type/preload";

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
    if (props.menudata.type === "root") {
      const uiLocked = computed(() => store.getters.UI_LOCKED);
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
        uiLocked,
        reassignSubMenuOpen,
        getMenuBarHotkey,
      };
    }
    return { getMenuBarHotkey };
  },
});
</script>
