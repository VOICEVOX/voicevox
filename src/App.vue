<template>
  <error-boundary>
    <router-view />
  </error-boundary>
</template>

<script lang="ts">
import { useStore } from "@/store";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import { defineComponent, watch } from "vue";
import { useGtm } from "@gtm-support/vue-gtm";
import { useRoute } from "vue-router";

export default defineComponent({
  name: "App",

  components: {
    ErrorBoundary,
  },

  setup() {
    const store = useStore();
    store.dispatch("INIT_VUEX");

    const isSafeMode = useRoute().query["isSafeMode"] === "true";
    store.dispatch("SET_IS_SAFE_MODE", isSafeMode);
    // Google Tag Manager
    const gtm = useGtm();
    watch(
      () => store.state.acceptRetrieveTelemetry,
      (acceptRetrieveTelemetry) => {
        gtm?.enable(acceptRetrieveTelemetry === "Accepted");
      },
      { immediate: true }
    );
  },
});
</script>
