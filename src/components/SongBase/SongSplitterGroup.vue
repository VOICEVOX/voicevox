<template>
  <SplitterGroup :direction>
    <slot />
  </SplitterGroup>
</template>

<script lang="ts">
import type { InjectionKey } from "vue";

export const songSplitterGroupInjectionKey: InjectionKey<{
  commitListeners: Set<() => void>;
  commit: () => void;
}> = Symbol("songSplitterGroup");
</script>

<script setup lang="ts">
import { provide } from "vue";
import { SplitterGroup } from "reka-ui";

defineProps<{
  direction: "horizontal" | "vertical";
}>();

const commitListeners = new Set<() => void>();

provide(songSplitterGroupInjectionKey, {
  commitListeners,
  commit: () => {
    for (const listener of commitListeners) {
      listener();
    }
  },
});
</script>
