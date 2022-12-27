<template>
  <ErrorBoundary>
    <RouterView />
  </ErrorBoundary>
</template>

<script setup lang="ts">
import { useStore } from "@/store";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import { watch, computed } from "vue";
import { useGtm } from "@gtm-support/vue-gtm";
import { useRoute } from "vue-router";
const store = useStore();
store.dispatch("INIT_VUEX");

// URLパラメータに従ってセーフモードにする
const route = useRoute();
const query = computed(() => route.query);
watch(query, (newQuery) => {
  if (newQuery) {
    store.dispatch("SET_IS_SAFE_MODE", newQuery["isSafeMode"] === "true");
  }
});

// Google Tag Manager
const gtm = useGtm();
watch(
  () => store.state.acceptRetrieveTelemetry,
  (acceptRetrieveTelemetry) => {
    gtm?.enable(acceptRetrieveTelemetry === "Accepted");
  },
  { immediate: true }
);
</script>
