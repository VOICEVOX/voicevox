<!-- StoreのUI_LOCKEDを参照してContextMenuを表示する -->

<template>
  <Presentation ref="contextMenu" :header :menudata :uiLocked />
</template>

<script lang="ts">
export type { ContextMenuItemData } from "./Presentation.vue";
</script>
<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import type { ComponentExposed } from "vue-component-type-helpers";
import Presentation, { ContextMenuItemData } from "./Presentation.vue";
import { useStore } from "@/store";

defineOptions({
  name: "ContextMenu",
});

defineProps<{
  header?: string;
  menudata: ContextMenuItemData[];
}>();
defineExpose({
  hide: () => {
    contextMenu.value?.hide();
  },
});

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);
const contextMenu =
  useTemplateRef<ComponentExposed<typeof Presentation>>("contextMenu");
</script>
