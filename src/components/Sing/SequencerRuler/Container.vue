<template>
  <Presentation
    v-bind="props"
    :playheadPosition
    :tpqn
    :tempos
    :timeSignatures
    :zoomX
    :snapType
    :uiLocked
    @update:playheadPosition="updatePlayheadTicks"
    @deselectAllNotes="deselectAllNotes"
    @setTempo="setTempo"
    @setTimeSignature="setTimeSignature"
    @removeTempo="removeTempo"
    @removeTimeSignature="removeTimeSignature"
  />
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import { Tempo, TimeSignature } from "@/store/type";

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
const zoomX = computed(() => store.state.sequencerZoomX);
const snapType = computed(() => store.state.sequencerSnapType);
const uiLocked = computed(() => store.getters.UI_LOCKED);

const playheadPosition = ref(0);

const playheadPositionChangeListener = (position: number) => {
  playheadPosition.value = position;
};
const updatePlayheadTicks = (ticks: number) => {
  playheadPosition.value = ticks;

  void store.dispatch("SET_PLAYHEAD_POSITION", {
    position: ticks,
  });
};

const deselectAllNotes = () => {
  void store.dispatch("DESELECT_ALL_NOTES");
};
const setTempo = (tempo: Tempo) => {
  void store.dispatch("COMMAND_SET_TEMPO", {
    tempo,
  });
};
const setTimeSignature = (timeSignature: TimeSignature) => {
  void store.dispatch("COMMAND_SET_TIME_SIGNATURE", {
    timeSignature,
  });
};
const removeTempo = (position: number) => {
  void store.dispatch("COMMAND_REMOVE_TEMPO", {
    position,
  });
};
const removeTimeSignature = (measureNumber: number) => {
  void store.dispatch("COMMAND_REMOVE_TIME_SIGNATURE", {
    measureNumber,
  });
};

onMounted(() => {
  void store.dispatch("ADD_PLAYHEAD_POSITION_CHANGE_LISTENER", {
    listener: playheadPositionChangeListener,
  });
});
onUnmounted(() => {
  void store.dispatch("REMOVE_PLAYHEAD_POSITION_CHANGE_LISTENER", {
    listener: playheadPositionChangeListener,
  });
});
</script>
