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

export default defineComponent({
  name: "App",

  components: {
    ErrorBoundary,
  },

  setup() {
    const store = useStore();
    store.dispatch("INIT_VUEX");
    store.dispatch("START_WAITING_ENGINE");

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
