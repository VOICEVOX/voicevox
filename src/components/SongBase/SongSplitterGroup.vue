<template>
  <SplitterGroup :direction>
    <slot />
  </SplitterGroup>
</template>

<script setup lang="ts">
import { SplitterGroup } from "reka-ui";

defineProps<{
  direction: "horizontal" | "vertical";
}>();
</script>
