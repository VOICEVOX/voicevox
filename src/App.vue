<template>
  <error-boundary>
    <router-view />
  </error-boundary>
</template>

<script lang="ts">
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import { defineComponent } from "vue";

export default defineComponent({
  name: "App",

  components: {
    ErrorBoundary,
  },
});
</script>
