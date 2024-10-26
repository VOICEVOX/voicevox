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
import { computed, onMounted, onUnmounted, ref } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";

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

const playheadTicks = ref(0);

const updatePlayheadTicks = (ticks: number) => {
  void store.actions.SET_PLAYHEAD_POSITION({ position: ticks });
};

const playheadPositionChangeListener = (position: number) => {
  playheadTicks.value = position;
};

onMounted(() => {
  void store.actions.ADD_PLAYHEAD_POSITION_CHANGE_LISTENER({
    listener: playheadPositionChangeListener,
  });
});
onUnmounted(() => {
  void store.actions.REMOVE_PLAYHEAD_POSITION_CHANGE_LISTENER({
    listener: playheadPositionChangeListener,
  });
});

const deselectAllNotes = () => {
  void store.actions.DESELECT_ALL_NOTES();
};
</script>
