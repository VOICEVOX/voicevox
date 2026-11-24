<template>
  <div class="parameter-panel">
    <ParameterPanelEditToolBar />
    <div class="edit-area">
      <SequencerPhonemeTimingEditor
        v-if="editTarget === 'PHONEME_TIMING'"
        :viewportInfo
        @panTimeline="(deltaX) => emit('panTimeline', deltaX)"
        @zoomTimeline="
          (anchorX, deltaY) => emit('zoomTimeline', anchorX, deltaY)
        "
      />
      <SequencerVolumeEditor
        v-if="editTarget === 'VOLUME'"
        :viewportInfo
        @update:needsAutoScroll="
          (value) => emit('update:needsAutoScroll', value)
        "
        @panTimeline="(deltaX) => emit('panTimeline', deltaX)"
        @zoomTimeline="
          (anchorX, deltaY) => emit('zoomTimeline', anchorX, deltaY)
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SequencerVolumeEditor from "@/components/Song/SequencerVolumeEditor/Container.vue";
import { useStore } from "@/store";
import ParameterPanelEditToolBar from "@/components/Song/EditToolBar/ParameterPanelEditToolBar/Container.vue";
import SequencerPhonemeTimingEditor from "@/components/Song/SequencerPhonemeTimingEditor.vue";
import type { ViewportInfo } from "@/song/viewHelper";

defineProps<{ viewportInfo: ViewportInfo }>();

const emit = defineEmits<{
  "update:needsAutoScroll": [value: boolean];
  panTimeline: [deltaX: number];
  zoomTimeline: [anchorX: number, deltaY: number];
}>();

const store = useStore();

const editTarget = computed(() => store.state.parameterPanelEditTarget);
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

.parameter-panel {
  position: relative;
  width: 100%;
  height: 100%;

  overflow: hidden;
  display: grid;
  grid-template-rows: auto 1fr;
}

.edit-area {
  grid-column: 1;
  grid-row: 2;
  position: relative;
  overflow: hidden;
}
</style>
