<template>
  <slot />
</template>

<script setup lang="ts">
import { onErrorCaptured, onMounted } from "vue";
import { UnreachableError } from "@/type/utility";

const logError = (error: Error): void => {
  if (window.backend) {
    window.backend.logError(error);
  } else if (window.welcomeBackend) {
    window.welcomeBackend.logError(error);
  } else {
    throw new UnreachableError();
  }
};

onMounted(() => {
  // FIXME: Promiseのエラーハンドリングもっと考える
  const handlePromiseRejectionEvent = (event: PromiseRejectionEvent) => {
    if (event.reason instanceof Error) {
      logError(event.reason);
    } else if (event.reason instanceof Response) {
      logError(new Error(`HTTP ${event.reason.status} at ${event.reason.url}`));
    } else {
      logError(new Error(event.reason));
    }
  };
  window.addEventListener("error", (event: ErrorEvent) => {
    logError(event.error);
  });
  window.addEventListener("unhandledrejection", handlePromiseRejectionEvent);
  window.addEventListener("rejectionhandled", handlePromiseRejectionEvent);
});

onErrorCaptured((error) => {
  if (error instanceof Error) logError(error);
  return false;
});
</script>
