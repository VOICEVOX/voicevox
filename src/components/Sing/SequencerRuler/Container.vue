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
    :isLoopEnabled
    :loopStartTick
    :loopEndTick
    @update:playheadTicks="updatePlayheadTicks"
    @removeTempo="removeTempo"
    @removeTimeSignature="removeTimeSignature"
    @setTempo="setTempo"
    @setTimeSignature="setTimeSignature"
    @deselectAllNotes="deselectAllNotes"
    @setLoopEnabled="setLoopEnabled"
    @setLoopRange="setLoopRange"
    @clearLoopRange="clearLoopRange"
    @addOneMeasureLoop="addOneMeasureLoop"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import { Tempo, TimeSignature } from "@/store/type";
import { snapTicksToGrid, getNoteDuration } from "@/sing/domain";
import { baseXToTick } from "@/sing/viewHelper";

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

const isLoopEnabled = computed(() => store.state.isLoopEnabled);
const loopStartTick = computed(() => store.state.loopStartTick);
const loopEndTick = computed(() => store.state.loopEndTick);

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

const setLoopEnabled = (enabled: boolean) => {
  void store.actions.COMMAND_SET_LOOP_ENABLED({ isLoopEnabled: enabled });
};

const setLoopRange = (start: number, end: number) => {
  void store.actions.COMMAND_SET_LOOP_RANGE({
    loopStartTick: start,
    loopEndTick: end,
  });
};

const clearLoopRange = () => {
  void store.actions.COMMAND_CLEAR_LOOP_RANGE();
};

const addOneMeasureLoop = (clickX: number) => {
  const timeSignature = store.state.timeSignatures[0];
  const oneMeasureTicks =
    getNoteDuration(timeSignature.beatType, tpqn.value) * timeSignature.beats;
  const baseX = (props.offset + clickX) / sequencerZoomX.value;
  const cursorTick = baseXToTick(baseX, tpqn.value);
  const startTick = snapTicksToGrid(cursorTick, oneMeasureTicks);
  const endTick = snapTicksToGrid(startTick + oneMeasureTicks, oneMeasureTicks);
  void store.actions.COMMAND_SET_LOOP_RANGE({
    loopStartTick: startTick,
    loopEndTick: endTick,
  });
};
</script>
