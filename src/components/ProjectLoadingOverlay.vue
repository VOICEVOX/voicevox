<template>
  <div v-if="projectLoadingInfo" class="loading-project">
    <div>
      <QCircularProgress
        showValue
        fontSize="12px"
        :value="projectLoadingInfo.percent"
        size="50px"
        color="primary"
        trackColor="grey-3"
      >
        {{ projectLoadingInfo.percent }}%
      </QCircularProgress>
      <div class="q-mt-sm">{{ projectLoadingInfo.text }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";

const store = useStore();

const projectLoadingInfo = computed(() => store.state.projectLoadingInfo);
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
    padding: 20px;
    min-width: 240px;
  }
}
</style>
