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
import { resizeEndReceiverInjectionKey } from "./SongSplitterGroup.vue";

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

const resizeEndReceiver = inject(resizeEndReceiverInjectionKey);
if (resizeEndReceiver == undefined) {
  throw new Error("SongSplitterPanel must be used within SongSplitterGroup");
}

let size: number | undefined;
let committedSize: number | undefined;

const onResize = (newSize: number) => {
  // 初期化時にonResizeが呼ばれるので、そのときのnewSizeの値をcommittedSizeの初期値として設定する
  committedSize ??= newSize;
  size = newSize;
  emit("resize", newSize);
};

// Handleからリサイズ完了の通知を受けたとき、パネルサイズが変わっていれば確定する
const onResizeEnd = () => {
  if (size == undefined || size === committedSize) return;
  committedSize = size;
  emit("resizeCommit", size);
};

resizeEndReceiver.addListener(onResizeEnd);
onUnmounted(() => resizeEndReceiver.deleteListener(onResizeEnd));
</script>

<style scoped lang="scss">
.song-splitter-panel {
  isolation: isolate;
}
</style>
