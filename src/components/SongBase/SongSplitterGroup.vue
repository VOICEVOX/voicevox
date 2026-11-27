<template>
  <SplitterGroup :direction>
    <slot />
  </SplitterGroup>
</template>

<script lang="ts">
import type { InjectionKey } from "vue";

export const resizeEndSenderInjectionKey: InjectionKey<() => void> = Symbol(
  "songSplitterResizeEndSender",
);

export const resizeEndReceiverInjectionKey: InjectionKey<{
  addListener: (listener: () => void) => void;
  deleteListener: (listener: () => void) => void;
}> = Symbol("songSplitterResizeEndReceiver");
</script>

<script setup lang="ts">
import { provide } from "vue";
import { SplitterGroup } from "reka-ui";

defineProps<{
  direction: "horizontal" | "vertical";
}>();

// リサイズ完了の通知をHandleからPanelへ中継する
const resizeEndListeners = new Set<() => void>();

provide(resizeEndSenderInjectionKey, () => {
  for (const listener of resizeEndListeners) {
    listener();
  }
});
provide(resizeEndReceiverInjectionKey, {
  addListener: (listener) => {
    resizeEndListeners.add(listener);
  },
  deleteListener: (listener) => {
    resizeEndListeners.delete(listener);
  },
});
</script>
