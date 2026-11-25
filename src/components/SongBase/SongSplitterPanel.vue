<template>
  <SplitterPanel
    class="song-splitter-panel"
    :order
    :sizeUnit
    :defaultSize
    :minSize
    :maxSize
    @resize="onResize"
  >
    <slot />
  </SplitterPanel>
</template>

<script setup lang="ts">
import { inject, onUnmounted } from "vue";
import { SplitterPanel } from "reka-ui";
import { songSplitterGroupInjectionKey } from "./SongSplitterGroup.vue";

defineProps<{
  order?: number;
  sizeUnit?: "%" | "px";
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
}>();

const emit = defineEmits<{
  resize: [size: number];
  resizeCommit: [size: number];
}>();

const group = inject(songSplitterGroupInjectionKey);
if (group == undefined) {
  throw new Error("SongSplitterPanel must be used within SongSplitterGroup");
}

let size: number | undefined;
let committedSize: number | undefined;

const onResize = (newSize: number) => {
  // 初期化時の大きさは操作で変わったものではないので、確定済みとして扱う
  committedSize ??= newSize;
  size = newSize;
  emit("resize", newSize);
};

const commit = () => {
  if (size == undefined || size === committedSize) return;
  committedSize = size;
  emit("resizeCommit", size);
};

group.commitListeners.add(commit);
onUnmounted(() => group.commitListeners.delete(commit));
</script>

<style scoped lang="scss">
.song-splitter-panel {
  isolation: isolate;
}
</style>
