<template>
  <slot />
</template>

<script setup lang="ts">
import { onErrorCaptured, onMounted } from "vue";
import { createLogger } from "@/helpers/log";

const logger = createLogger("ErrorBoundary");

onMounted(() => {
  // FIXME: Promiseのエラーハンドリングもっと考える
  const handlePromiseRejectionEvent = (event: PromiseRejectionEvent) => {
    if (event.reason instanceof Error) {
      logger.error(event.reason);
    } else if (event.reason instanceof Response) {
      logger.error(
        new Error(`HTTP ${event.reason.status} at ${event.reason.url}`),
      );
    } else {
      logger.error(new Error(event.reason));
    }
  };
  window.addEventListener("error", (event: ErrorEvent) => {
    logger.error(event.error);
  });
  window.addEventListener("unhandledrejection", handlePromiseRejectionEvent);
  window.addEventListener("rejectionhandled", handlePromiseRejectionEvent);
});

onErrorCaptured((error) => {
  if (error instanceof Error) {
    logger.error(error);
  }
  return false;
});
</script>
