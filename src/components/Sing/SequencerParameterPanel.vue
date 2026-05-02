<template>
  <div class="parameter-panel">
    <div class="tool-area" aria-label="パラメータ編集操作">
      <ParameterPanelEditTargetSwitcher :editTarget :changeEditTarget />
    </div>
    <div class="parameter-panel-floating-tools">
      <div class="parameter-panel-tool-palette">
        <SequencerVolumeToolPalette
          v-if="editTarget === 'VOLUME'"
          :sequencerVolumeTool
          @update:sequencerVolumeTool="setSequencerVolumeTool"
        />
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
  --editor-tool-rail-width: 40px;

  position: relative;
  width: 100%;
  height: 100%;

  overflow: hidden;
  display: grid;
  grid-template-columns: var(--editor-tool-rail-width) minmax(0, 1fr);
  grid-template-rows: 1fr;
}

.tool-area {
  grid-column: 1;
  grid-row: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 6px;
  background: color-mix(
    in oklch,
    var(--scheme-color-surface-container-low) 74%,
    transparent
  );
  border-right: 1px solid
    color-mix(in oklch, var(--scheme-color-outline-variant) 50%, transparent);
}

.tool-area :deep(.edit-target-switcher) {
  pointer-events: auto;
}

.parameter-panel-floating-tools {
  grid-column: 1 / -1;
  grid-row: 1;
  align-self: start;
  justify-self: start;
  margin: 6px 0 0 calc(var(--editor-tool-rail-width) + 4px);
  z-index: 2;
  pointer-events: none;
}

.parameter-panel-tool-palette :deep(.tool-palette) {
  pointer-events: auto;
}

.edit-area {
  grid-column: 2;
  grid-row: 1;
  position: relative;
  overflow: hidden;
}
</style>
