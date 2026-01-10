<template>
  <ErrorBoundary>
    <TooltipProvider disableHoverableContent :delayDuration="500">
      Welcome画面TODO
    </TooltipProvider>
  </ErrorBoundary>
</template>

<script setup lang="ts">
import { TooltipProvider } from "reka-ui";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
</script>
