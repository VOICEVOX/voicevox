<template>
  <div class="parameter-panel">
    <div class="tool-area" aria-label="パラメータ編集操作">
      <div class="parameter-panel-toolbar-controls">
        <div class="parameter-panel-mode-zone">
          <ParameterPanelEditTargetSwitcher :editTarget :changeEditTarget />
          <SequencerVolumeToolPalette
            v-if="editTarget === 'VOLUME'"
            :sequencerVolumeTool
            @update:sequencerVolumeTool="setSequencerVolumeTool"
          />
        </div>
      </div>
    </div>
    <div class="edit-area">
      <SequencerPhonemeTimingEditor v-if="editTarget === 'PHONEME_TIMING'" />
      <SequencerVolumeEditor
        v-if="editTarget === 'VOLUME'"
        :offsetX="props.offsetX"
        @update:needsAutoScroll="
          (value) => emit('update:needsAutoScroll', value)
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SequencerVolumeEditor from "@/components/Sing/SequencerVolumeEditor.vue";
import { useStore } from "@/store";
import type { ParameterPanelEditTarget, VolumeEditTool } from "@/store/type";
import ParameterPanelEditTargetSwitcher from "@/components/Sing/ParameterPanelEditTargetSwitcher.vue";
import SequencerPhonemeTimingEditor from "@/components/Sing/SequencerPhonemeTimingEditor.vue";
import SequencerVolumeToolPalette from "@/components/Sing/SequencerVolumeToolPalette.vue";

const props = defineProps<{
  offsetX: number;
}>();

const emit = defineEmits<{
  "update:needsAutoScroll": [value: boolean];
}>();

const store = useStore();

const editTarget = computed(() => store.state.parameterPanelEditTarget);

const changeEditTarget = (editTarget: ParameterPanelEditTarget) => {
  void store.actions.SET_PARAMETER_PANEL_EDIT_TARGET({ editTarget });
};

const sequencerVolumeTool = computed(() => store.state.sequencerVolumeTool);
const setSequencerVolumeTool = (sequencerVolumeTool: VolumeEditTool) => {
  void store.actions.SET_SEQUENCER_VOLUME_TOOL({ sequencerVolumeTool });
};
</script>

<style scoped lang="scss">
.parameter-panel {
  position: relative;
  width: 100%;
  height: 100%;

  overflow: hidden;
  display: grid;
  grid-template-rows: 30px 1fr;
}

.tool-area {
  grid-column: 1;
  grid-row: 1;
}

.parameter-panel-toolbar-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  padding: 2px 8px 0 56px;
}

.parameter-panel-mode-zone {
  display: flex;
  align-items: center;
  gap: 8px;
}

.parameter-panel-mode-zone :deep(.tool-palette) {
  pointer-events: auto;
}

.edit-area {
  grid-column: 1;
  grid-row: 2;
  position: relative;
  overflow: hidden;
}
</style>
