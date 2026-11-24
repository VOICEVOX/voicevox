<template>
  <Presentation
    v-model:editTarget="editTarget"
    v-model:volumeTool="volumeTool"
    v-model:phonemeTimingTool="phonemeTimingTool"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";

defineOptions({
  name: "ParameterPanelEditToolBar",
});

const store = useStore();

const editTarget = computed({
  get: () => store.state.parameterPanelEditTarget,
  set: (editTarget) => {
    void store.actions.SET_PARAMETER_PANEL_EDIT_TARGET({ editTarget });
  },
});

const volumeTool = computed({
  get: () => store.state.sequencerVolumeTool,
  set: (sequencerVolumeTool) => {
    void store.actions.SET_SEQUENCER_VOLUME_TOOL({ sequencerVolumeTool });
  },
});

const phonemeTimingTool = computed({
  get: () => store.state.sequencerPhonemeTimingTool,
  set: (sequencerPhonemeTimingTool) => {
    void store.actions.SET_SEQUENCER_PHONEME_TIMING_TOOL({
      sequencerPhonemeTimingTool,
    });
  },
});
</script>
