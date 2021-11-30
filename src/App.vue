<template>
  <error-boundary>
    <router-view />
  </error-boundary>
</template>

<script lang="ts">
import { useStore } from "@/store";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import { defineComponent } from "vue";

export default defineComponent({
  name: "App",

  components: {
    ErrorBoundary,
  },

  setup() {
    const store = useStore();
    store.dispatch("INIT_VUEX");
    store.dispatch("START_WAITING_ENGINE");
  },
});
</script>
