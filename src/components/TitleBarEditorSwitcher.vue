<!--
タイトルバーに配置される、エディタを切り替えるボタン
-->

<template>
  <!-- FIXME: 画面サイズが小さくなると表示が崩れるのを直す -->
  <!-- NOTE: デザインしづらいからQBtnかdivの方が良い -->
  <q-btn-toggle
    :model-value="nowEditor"
    unelevated
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

const router = useRouter();
const nowEditor = computed<"talk" | "song">(() => {
  const path = router.currentRoute.value.path;
  if (path === "/talk") return "talk";
  if (path === "/song") return "song";
  window.electron.logWarn(`unknown path: ${path}`);
  return "talk";
});

const gotoLink = (editor: "talk" | "song") => {
  router.push("/" + editor);
};
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;
.q-btn-group {
  // 選択されているボタンの文字を太字にする
  :deep(.q-btn[aria-pressed="true"]) {
    span {
      font-weight: 700;
      color: colors.$display !important;
    }
  }
}
</style>
