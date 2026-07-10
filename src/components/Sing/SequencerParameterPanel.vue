<template>
  <div class="parameter-panel">
    <div class="tool-area">
      パラメータ
      <!-- 仮のSwitcher -->
      <ParameterPanelEditTargetSwitcher :editTarget :changeEditTarget />
    </div>
    <div class="edit-area">
      <SequencerPhonemeTimingEditor
        v-if="editTarget === 'PHONEME_TIMING'"
        :viewportInfo
      />
      <div v-if="editTarget === 'VOLUME'" class="volume-reference-editor">
        <SequencerVolumeEditor
          class="volume-editor-layer"
          :viewportInfo
          :noteMovePreview
          @update:needsAutoScroll="
            (value) => emit('update:needsAutoScroll', value)
          "
          @panTimeline="(deltaX) => emit('panTimeline', deltaX)"
          @zoomTimeline="
            (anchorX, deltaY) => emit('zoomTimeline', anchorX, deltaY)
          "
        />
        <SequencerWaveform
          class="volume-waveform-reference"
          :viewportInfo
          displayMode="BOTTOM_ALIGNED"
          aria-hidden="true"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SequencerVolumeEditor from "@/components/Sing/SequencerVolumeEditor/Container.vue";
import { useStore } from "@/store";
import type { ParameterPanelEditTarget } from "@/store/type";
import ParameterPanelEditTargetSwitcher from "@/components/Sing/ParameterPanelEditTargetSwitcher.vue";
import SequencerPhonemeTimingEditor from "@/components/Sing/SequencerPhonemeTimingEditor.vue";
import SequencerWaveform from "@/components/Sing/SequencerWaveform.vue";
import type { ViewportInfo } from "@/sing/viewHelper";
import type { Note } from "@/domain/project/type";
import { VOLUME_EDITOR_LAYOUT } from "@/components/Sing/SequencerVolumeEditor/style";

defineProps<{
  viewportInfo: ViewportInfo;
  noteMovePreview?: Note[];
}>();

const emit = defineEmits<{
  "update:needsAutoScroll": [value: boolean];
  panTimeline: [deltaX: number];
  zoomTimeline: [anchorX: number, deltaY: number];
}>();

const store = useStore();

const editTarget = computed(() => store.state.parameterPanelEditTarget);

const VOLUME_OUTPUT_REFERENCE_HEIGHT_PX = 40;

const changeEditTarget = (editTarget: ParameterPanelEditTarget) => {
  void store.actions.SET_PARAMETER_PANEL_EDIT_TARGET({ editTarget });
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

.parameter-panel {
  position: relative;
  width: 100%;
  height: 100%;

  overflow: hidden;
  display: grid;
  grid-template-rows: 48px 1fr;
}

.tool-area {
  grid-column: 1;
  grid-row: 1;
  border-bottom: solid 1px var(--scheme-color-sing-piano-keys-right-border);

  display: flex;
  align-items: center;
  padding-left: 8px;
  column-gap: 8px;
}

.edit-area {
  grid-column: 1;
  grid-row: 2;
  position: relative;
  overflow: hidden;
}

.volume-reference-editor {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--scheme-color-sing-grid-cell-white);
}

.volume-editor-layer {
  position: relative;
  z-index: 1;
}

.volume-waveform-reference {
  position: absolute;
  inset: auto 0 0 v-bind("`${VOLUME_EDITOR_LAYOUT.keyColumnWidthPx}px`");
  z-index: 0;
  height: v-bind("`${VOLUME_OUTPUT_REFERENCE_HEIGHT_PX}px`");
  opacity: 0.7;
  pointer-events: none;
}
</style>
