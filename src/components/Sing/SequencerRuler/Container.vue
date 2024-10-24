<template>
  <Presentation
    :offset
    :tpqn
    :timeSignatures
    :sequencerZoomX
    :numMeasures
    :playheadTicks
    @update:playheadTicks="updatePlayheadTicks"
    @deselectAllNotes="deselectAllNotes"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import { usePlayheadPosition } from "@/composables/usePlayheadPosition";

defineOptions({
  name: "SequencerRuler",
});

withDefaults(
  defineProps<{
    offset: number;
    numMeasures: number;
  }>(),
  {
    offset: 0,
    numMeasures: 32,
  },
);

const store = useStore();
const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);

const playheadTicks = usePlayheadPosition();

const updatePlayheadTicks = (ticks: number) => {
  playheadTicks.value = ticks;
};

const deselectAllNotes = () => {
  void store.dispatch("DESELECT_ALL_NOTES");
};
</script>
