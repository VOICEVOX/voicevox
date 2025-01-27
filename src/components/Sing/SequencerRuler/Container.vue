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
  >
    <GridLaneContainer
      :tpqn
      :sequencerZoomX
      :numMeasures
      :timeSignatures
      :offset
    />
    <ValueMarkerLaneContainer
      :tpqn
      :sequencerZoomX
      :tempos
      :timeSignatures
      :offset
      :playheadTicks
      :uiLocked
      @setTempo="setTempo"
      @removeTempo="removeTempo"
      @setTimeSignature="setTimeSignature"
      @removeTimeSignature="removeTimeSignature"
    />
    <LoopLaneContainer :offset :width />
  </Presentation>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Presentation from "./Presentation.vue";
import GridLaneContainer from "./GridLane/Container.vue";
import ValueMarkerLaneContainer from "./ValueMarkerLane/Container.vue";
import LoopLaneContainer from "./LoopLane/Container.vue";
import { useStore } from "@/store";
import { Tempo, TimeSignature } from "@/store/type";
import { tickToBaseX } from "@/sing/viewHelper";
import { getTimeSignaturePositions, getMeasureDuration } from "@/sing/domain";

defineOptions({
  name: "SequencerRuler",
});

const props = withDefaults(
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

const width = computed(() => {
  const lastTs = timeSignatures.value[timeSignatures.value.length - 1];
  const tsPositions = getTimeSignaturePositions(
    timeSignatures.value,
    tpqn.value,
  );
  const lastTsPosition = tsPositions[tsPositions.length - 1];
  const measureDuration = getMeasureDuration(
    lastTs.beats,
    lastTs.beatType,
    tpqn.value,
  );
  const endTicks =
    lastTsPosition +
    measureDuration * (props.numMeasures - lastTs.measureNumber + 1);
  return tickToBaseX(endTicks, tpqn.value) * sequencerZoomX.value;
});
</script>
