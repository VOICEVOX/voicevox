<template>
  <Presentation
    v-model:editTarget="editTarget"
    v-model:noteTool="noteTool"
    v-model:pitchTool="pitchTool"
    v-model:snapType="snapType"
    :snapTypes
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import { getSnapTypes } from "@/song/domain";

defineOptions({
  name: "SequencerEditToolBar",
});

const store = useStore();

const editTarget = computed({
  get: () => store.state.sequencerEditTarget,
  set: (editTarget) => {
    void store.actions.SET_EDIT_TARGET({ editTarget });
  },
});

const noteTool = computed({
  get: () => store.state.sequencerNoteTool,
  set: (sequencerNoteTool) => {
    void store.actions.SET_SEQUENCER_NOTE_TOOL({ sequencerNoteTool });
  },
});

const pitchTool = computed({
  get: () => store.state.sequencerPitchTool,
  set: (sequencerPitchTool) => {
    void store.actions.SET_SEQUENCER_PITCH_TOOL({ sequencerPitchTool });
  },
});

const snapType = computed({
  get: () => store.state.sequencerSnapType,
  set: (snapType) => {
    void store.actions.SET_SNAP_TYPE({ snapType });
  },
});

const snapTypes = computed(() => getSnapTypes(store.state.tpqn));
</script>
