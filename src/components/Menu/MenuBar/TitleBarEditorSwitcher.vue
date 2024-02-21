<!--
タイトルバーに配置される、エディタを切り替えるボタン
-->

<template>
  <!-- FIXME: 画面サイズが小さくなると表示が崩れるのを直す -->
  <!-- NOTE: デザインしづらいからQBtnかdivの方が良い -->
  <q-btn-toggle
    :model-value="nowEditor"
    unelevated
    :disable="uiLocked"
    dense
    toggle-color="primary"
    :options="[
      { label: 'トーク', value: 'talk' },
      { label: 'ソング', value: 'song' },
    ]"
    @update:model-value="gotoLink"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "@/store";
import { EditorType } from "@/type/preload";

const store = useStore();
const router = useRouter();

const uiLocked = computed(() => store.getters.UI_LOCKED);

const nowEditor = computed<EditorType>(() => {
  const path = router.currentRoute.value.path;
  if (path === "/talk") return "talk";
  if (path === "/song") return "song";
  window.electron.logWarn(`unknown path: ${path}`);
  return "talk";
});

const gotoLink = (editor: EditorType) => {
  router.push("/" + editor);
};
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;
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
