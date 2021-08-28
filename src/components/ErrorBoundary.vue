<template>
  <slot></slot>
</template>

<script lang="ts">
import { Component, defineComponent } from "vue";
import { useStore, CAPTURE_ERROR } from "@/store";

export default defineComponent({
  name: "ErrorBoundary",
  data(): {
    error: Error | null;
    instance: Component | null;
    info: string | null;
  } {
    return {
      error: null,
      instance: null,
      info: null,
    };
  },
  setup() {
    const store = useStore();
    const captureError = (error: Error): void => {
      store.dispatch(CAPTURE_ERROR, { error, stack: error.stack });
    };
    return { captureError };
  },
  errorCaptured(error, instance, info) {
    this.error = error instanceof Error ? error : null;
    this.instance = instance;
    this.info = info;
    if (this.error) this.captureError(this.error);
    return false;
  },
  mounted() {
    const handlePromiseRejectionEvent = (event: PromiseRejectionEvent) => {
      this.error = event.reason;
      this.instance = null;
      this.info = null;
      if (this.error) this.captureError(this.error);
    };
    window.addEventListener("error", (event: ErrorEvent) => {
      this.error = event.error;
      this.instance = null;
      this.info = null;
      if (this.error) this.captureError(this.error);
    });
    window.addEventListener("unhandledrejection", handlePromiseRejectionEvent);
    window.addEventListener("rejectionhandled", handlePromiseRejectionEvent);
  },
});
</script>
