<!--
タイトルバーに配置される、エディタを切り替えるボタン
-->

<template>
  <!-- FIXME: 画面サイズが小さくなると表示が崩れるのを直す -->
  <!-- NOTE: デザインしづらいからQBtnかdivの方が良い -->
  <QBtnToggle
    :modelValue="openedEditor"
    unelevated
    :disable="uiLocked"
    dense
    toggleColor="primary"
    :options="[
      { label: 'トーク', value: 'talk' },
      { label: 'ソング', value: 'song' },
    ]"
    @update:modelValue="switchEditor"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";
import { EditorType } from "@/type/preload";

const store = useStore();

const openedEditor = computed(() => store.state.openedEditor);
const uiLocked = computed(() => store.getters.UI_LOCKED);

const switchEditor = async (editor: EditorType) => {
  await store.dispatch("SET_ROOT_MISC_SETTING", {
    key: "openedEditor",
    value: editor,
  });
};
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;
.q-btn-group {
  :deep(.q-btn) {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  // 選択されているボタンの文字を太字にする
  :deep(.q-btn[aria-pressed="true"]) {
    span {
      font-weight: 700;
      color: colors.$display-on-primary !important;
    }
  }
}
</style>
