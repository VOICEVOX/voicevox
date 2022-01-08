<template v-if="{ isInitialized }">
  <error-boundary>
    <router-view />
  </error-boundary>
</template>

<script lang="ts">
import { useStore } from "@/store";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import { defineComponent, onMounted, ref } from "vue";

export default defineComponent({
  name: "App",

  components: {
    ErrorBoundary,
  },

  setup() {
    const isInitialized = ref(false);

    onMounted(async () => {
      window.electron.logInfo("App: onMounted");

      const store = useStore();

      await store.dispatch("INIT_VUEX");
      window.electron.logInfo("vuex inited");

      await store.dispatch("START_WAITING_ENGINE");
      window.electron.logInfo("setup done");

      isInitialized.value = true;
    });

    return {
      isInitialized,
    };
  },
});
</script>
