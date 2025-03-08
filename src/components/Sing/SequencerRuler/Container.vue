<template>
  <Presentation
    :offset
    :numMeasures
    :tpqn
    :tempos
    :timeSignatures
    :sequencerZoomX
    :uiLocked
    :playheadTicks
    :sequencerSnapType
    @update:playheadTicks="updatePlayheadTicks"
    @removeTempo="removeTempo"
    @removeTimeSignature="removeTimeSignature"
    @setTempo="setTempo"
    @setTimeSignature="setTimeSignature"
    @deselectAllNotes="deselectAllNotes"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import { Tempo, TimeSignature } from "@/store/type";

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
const tempos = computed(() => store.state.tempos);
const timeSignatures = computed(() => store.state.timeSignatures);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const uiLocked = computed(() => store.getters.UI_LOCKED);
const sequencerSnapType = computed(() => store.state.sequencerSnapType);

const playheadTicks = computed(() => store.getters.PLAYHEAD_POSITION);

const updatePlayheadTicks = (ticks: number) => {
  void store.actions.SET_PLAYHEAD_POSITION({ position: ticks });
};

const deselectAllNotes = () => {
  void store.actions.DESELECT_ALL_NOTES();
};

const setTempo = (tempo: Tempo) => {
  void store.actions.COMMAND_SET_TEMPO({
    tempo,
  });
};
const setTimeSignature = (timeSignature: TimeSignature) => {
  void store.actions.COMMAND_SET_TIME_SIGNATURE({
    timeSignature,
  });
};
const removeTempo = (position: number) => {
  void store.actions.COMMAND_REMOVE_TEMPO({
    position,
  });
};
const removeTimeSignature = (measureNumber: number) => {
  void store.actions.COMMAND_REMOVE_TIME_SIGNATURE({
    measureNumber,
  });
};
</script>
