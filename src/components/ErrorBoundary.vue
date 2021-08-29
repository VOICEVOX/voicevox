<template>
  <slot />
</template>

<script lang="ts">
import { defineComponent, onErrorCaptured, onMounted } from "vue";
import { useStore, CAPTURE_ERROR } from "@/store";

export default defineComponent({
  name: "ErrorBoundary",
  setup() {
    const store = useStore();
    const captureError = (error: Error): void => {
      store.dispatch(CAPTURE_ERROR, { error, stack: error.stack });
    };

    onMounted(() => {
      const handlePromiseRejectionEvent = (event: PromiseRejectionEvent) => {
        captureError(event.reason);
      };
      window.addEventListener("error", (event: ErrorEvent) => {
        captureError(event.error);
      });
      window.addEventListener(
        "unhandledrejection",
        handlePromiseRejectionEvent
      );
      window.addEventListener("rejectionhandled", handlePromiseRejectionEvent);
    });

    onErrorCaptured((error) => {
      if (error instanceof Error) captureError(error);
      return false;
    });
  },
});
</script>
