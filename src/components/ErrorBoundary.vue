<template>
  <slot />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { useStore, CAPTURE_ERROR } from "@/store";

export default defineComponent({
  name: "ErrorBoundary",
  data(): {
    error: Error | null;
  } {
    return {
      error: null,
    };
  },
  setup() {
    const store = useStore();
    const captureError = (error: Error): void => {
      store.dispatch(CAPTURE_ERROR, { error, stack: error.stack });
    };
    return { captureError };
  },
  errorCaptured(error) {
    this.error = error instanceof Error ? error : null;
    if (this.error) this.captureError(this.error);
    return false;
  },
  mounted() {
    const handlePromiseRejectionEvent = (event: PromiseRejectionEvent) => {
      this.error = event.reason;
      if (this.error) this.captureError(this.error);
    };
    window.addEventListener("error", (event: ErrorEvent) => {
      this.error = event.error;
      if (this.error) this.captureError(this.error);
    });
    window.addEventListener("unhandledrejection", handlePromiseRejectionEvent);
    window.addEventListener("rejectionhandled", handlePromiseRejectionEvent);
  },
});
</script>
