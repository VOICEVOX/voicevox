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
      // FIXME: Promiseのエラーハンドリングもっと考える
      const handlePromiseRejectionEvent = (event: PromiseRejectionEvent) => {
        if (event.reason instanceof Error) {
          logError(event.reason);
        } else if (event.reason instanceof Response) {
          logError(
            new Error(`HTTP ${event.reason.status} at ${event.reason.url}`)
          );
        } else {
          logError(new Error(event.reason));
        }
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
