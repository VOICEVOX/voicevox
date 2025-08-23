<template>
  <div v-if="isProjectLoading" class="loading-project">
    <div>
      <QSpinner color="primary" size="2.5rem" />
      <div class="q-mt-xs">プロジェクト読み込み中・・・</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";

const store = useStore();

const isProjectLoading = computed(() => store.state.isProjectLoading);
</script>

<style scoped lang="scss">
@use "@/styles/colors" as colors;

.loading-project {
  background-color: rgba(colors.$display-rgb, 0.15);
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: center;
  > div {
    color: colors.$display;
    background: colors.$surface;
    border-radius: 6px;
    padding: 14px;
  }
}
</style>
