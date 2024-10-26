<template>
  <Presentation
    :offset
    :numMeasures
    :tpqn
    :tempos
    :timeSignatures
    :sequencerZoomX
    :snapType
    :uiLocked
    :playheadPosition
    @update:playheadPosition="updatePlayheadPosition"
    @removeTempo="removeTempo"
    @removeTimeSignature="removeTimeSignature"
    @setTempo="setTempo"
    @setTimeSignature="setTimeSignature"
    @deselectAllNotes="deselectAllNotes"
  >
    <template #contextMenu="{ onContextMenuMounted, ...props }">
      <ContextMenu
        v-bind="props"
        :ref="
          (el) =>
            onContextMenuMounted(
              el as ComponentPublicInstance<typeof ContextMenu>,
            )
        "
      />
    </template>
  </Presentation>
</template>

<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  ComponentPublicInstance,
} from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import { Tempo, TimeSignature } from "@/store/type";
import ContextMenu from "@/components/Menu/ContextMenu.vue";

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
const snapType = computed(() => store.state.sequencerSnapType);
const uiLocked = computed(() => store.getters.UI_LOCKED);

const playheadPosition = ref(0);

const playheadPositionChangeListener = (position: number) => {
  playheadPosition.value = position;
};

const updatePlayheadPosition = (ticks: number) => {
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
