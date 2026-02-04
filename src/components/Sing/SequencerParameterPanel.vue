<template>
  <div class="parameter-panel">
    <div class="tool-area">
      パラメータ
      <!-- 仮のSwitcher -->
      <ParameterPanelEditTargetSwitcher :editTarget :changeEditTarget />
    </div>
    <div class="edit-area">
      <SequencerPhonemeTimingEditor v-if="editTarget === 'PHONEME_TIMING'" />
      <SequencerVolumeEditor
        v-if="editTarget === 'VOLUME'"
        :playheadTicks
        :tempos
        :tpqn
        :zoomX
        :zoomY
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SequencerVolumeEditor from "@/components/Sing/SequencerVolumeEditor.vue";
import { useStore } from "@/store";
import type { ParameterPanelEditTarget } from "@/store/type";
import ParameterPanelEditTargetSwitcher from "@/components/Sing/ParameterPanelEditTargetSwitcher.vue";
import SequencerPhonemeTimingEditor from "@/components/Sing/SequencerPhonemeTimingEditor.vue";

const store = useStore();

const playheadTicks = computed(() => store.getters.PLAYHEAD_POSITION);
const tempos = computed(() => store.state.tempos);
const tpqn = computed(() => store.state.tpqn);
const zoomX = computed(() => store.state.sequencerZoomX);
const zoomY = computed(() => store.state.sequencerZoomY);

const editTarget = computed(() => store.state.parameterPanelEditTarget);

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
}
</style>
