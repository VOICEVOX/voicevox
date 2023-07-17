<template>
  <q-menu
    ref="contextmenu"
    touch-position
    context-menu
    :no-focus="noFocus"
    @vnode-mounted="setButtonCapturer()"
    @vnode-unmounted="removeButtonCapturer()"
    @before-show="startOperation()"
    @before-hide="endOperation()"
  >
    <q-list dense>
      <q-item v-if="header" dense class="bg-background">
        <q-item-section class="text-weight-bold">{{ header }}</q-item-section>
      </q-item>
      <menu-item
        v-for="(menu, index) of menudata"
        :key="index + 1"
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
import { computed, nextTick, ref } from "vue";
import { QMenu } from "quasar";
import MenuItem from "@/components/MenuItem.vue";
import { MenuItemButton, MenuItemSeparator } from "@/components/MenuBar.vue";
import { useStore } from "@/store";

defineProps<{
  header?: string;
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
const uiLocked = computed(() => store.getters.UI_LOCKED);

const contextmenu = ref<QMenu>();
/**
 * コンテキストメニューがフォーカスを奪うかどうかを制御する。
 * 通常はアクセシビリティ考慮のためにフォーカスが移るが、input要素の場合は文字の選択範囲が非表示になってしまう。
 * この挙動が不要だと考えられるユーザーに向けてはフォーカスを奪わないようにする。
 */
const noFocus = ref(false);

const buttonCapturer = (event: Event) => {
  if (event instanceof PointerEvent) {
    // 右クリックから開いた場合は選択範囲の非表示回避のためにフォーカスされない
    // キーボードから開いた場合はアクセシビリティ(tabキーでの操作)を考慮してフォーカスされる
    noFocus.value = event.button === 2;
  }
};
const setButtonCapturer = () => {
  parent.addEventListener("contextmenu", buttonCapturer, { capture: true });
};
const removeButtonCapturer = () => {
  parent.removeEventListener("contextmenu", buttonCapturer);
};

// Expose
const willDispatchFocusOrBlur = ref(false);
const startOperation = () => {
  willDispatchFocusOrBlur.value = true;
};
const endOperation = async () => {
  await nextTick();
  willDispatchFocusOrBlur.value = false;
};

export type ContextMenuItemData = MenuItemSeparator | MenuItemButton;
</script>

<style lang="scss" scoped></style>
