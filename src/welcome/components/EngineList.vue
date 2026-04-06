<template>
  <div
    v-if="
      loadingEngineInfosState.type === 'uninitialized' ||
      loadingEngineInfosState.type === 'loadingCurrent'
    "
    class="engine-loading"
  >
    <QSpinner color="primary" size="2.5rem" :thickness="5" />
    <div class="loading-text">読み込み中...</div>
  </div>
  <template v-else-if="loadingEngineInfosState.type === 'loaded'">
    <EngineCard
      v-for="engine in loadingEngineInfosState.engineInfos"
      :key="engine.package.engineId"
      :engineId="engine.package.engineId"
    />
  </template>
</template>

<script setup lang="ts">
import EngineCard from "./EngineCard.vue";
import { useStore } from "@/welcome/store";

const store = useStore();
const { loadingEngineInfosState } = store;
</script>

<style scoped lang="scss">
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/variables" as vars;

.engine-loading {
  display: grid;
  place-items: center;
  gap: vars.$gap-1;
  padding: vars.$padding-2;
  color: colors.$display-sub;
}

.loading-text {
  font-size: 0.8rem;
}
</style>
