<template>
  <q-menu
    ref="contextmenu"
    touch-position
    context-menu
    :no-focus="noFocus"
    @before-show="startOperation"
    @before-hide="endOperation()"
  >
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
import { computed, nextTick, ref, useSlots } from "vue";
import { QMenu } from "quasar";
import MenuItem from "@/components/MenuItem.vue";
import { MenuItemButton, MenuItemSeparator } from "@/components/MenuBar.vue";
import { useStore } from "@/store";

defineProps<{
  menudata: ContextMenuItemData[];
}>();
defineExpose({
  /**
   * コンテキストメニューの開閉によりFocusやBlurが発生する可能性のある間は`true`。
   */
  // no-focus を付けた場合と付けてない場合でタイミングが異なるため、両方に対応。
  willDispatchFocusOrBlur: computed(() => willDispatchFocusOrBlur.value),
  hide: () => {
    contextmenu.value?.hide();
  },
});
const store = useStore();
const slots = useSlots();
const uiLocked = computed(() => store.getters.UI_LOCKED);

const contextmenu = ref<QMenu>();
const noFocus = ref(false);

// Expose
const willDispatchFocusOrBlur = ref(false);
const startOperation = async (event: Event) => {
  willDispatchFocusOrBlur.value = true;
  if (!(event instanceof PointerEvent)) {
    throw new Error("不明なイベントです。");
  }
  // 右クリックから開いた場合は選択範囲の非表示回避のためにフォーカスされない
  // キーボードから開いた場合はアクセシビリティ(tabキーでの操作)を考慮してフォーカスされる
  noFocus.value = event.button === 2;
};
const endOperation = async () => {
  await nextTick();
  willDispatchFocusOrBlur.value = false;
};

export type ContextMenuItemData = MenuItemSeparator | MenuItemButton;
</script>

<style lang="scss" scoped></style>
