<template>
  <div ref="root" class="handler"><div /></div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from "vue";
import { useStore } from "@/store";
import { SET_AUDIO_DETAIL_PANE_OFFSET } from "@/store/ui";

export default defineComponent({
  name: "AudioDetailPaneSeparator",

  setup() {
    const store = useStore();

    const root = ref<HTMLElement>();

    let isHandlerDragging = false;

    onMounted(() => {
      root.value!.addEventListener("mousedown", (e) => {
        isHandlerDragging = true;
      });

      document.addEventListener("mousemove", (e) => {
        if (!isHandlerDragging) {
          return false;
        }

        store.commit(SET_AUDIO_DETAIL_PANE_OFFSET, { offset: e.clientY });
      });

      document.addEventListener("mouseup", (e) => {
        isHandlerDragging = false;
      });
    });

    return { root };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles' as global;

.handler {
  background-color: global.$primary;
  height: 3px;
  z-index: global.$pane-separator-zindex;
  cursor: ns-resize;
  display: flex;
  flex-direction: column;
  justify-content: center;
  div {
    padding: 10px 0;
    margin: -10px 0;
  }
}
</style>
