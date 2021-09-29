<template>
  <slot />
</template>

<script lang="ts">
import { defineComponent, onErrorCaptured, onMounted } from "vue";
import { useStore } from "@/store";

export default defineComponent({
  name: "ErrorBoundary",
  setup() {
    const store = useStore();
    const logError = (error: Error): void => {
      store.dispatch("LOG_ERROR", error.stack);
    };

    onMounted(() => {
      const handlePromiseRejectionEvent = (event: PromiseRejectionEvent) => {
        logError(event.reason);
      };
      window.addEventListener("error", (event: ErrorEvent) => {
        logError(event.error);
      });
      window.addEventListener(
        "unhandledrejection",
        handlePromiseRejectionEvent
      );
      window.addEventListener("rejectionhandled", handlePromiseRejectionEvent);
    });

    onErrorCaptured((error) => {
      if (error instanceof Error) logError(error);
      return false;
    });
  },
});
</script>
