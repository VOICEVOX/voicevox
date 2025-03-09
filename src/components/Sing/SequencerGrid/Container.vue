<template>
  <Presentation
    :tpqn
    :timeSignatures
    :sequencerZoomX
    :sequencerZoomY
    :sequencerSnapType
    :numMeasures
    :offsetX="props.offsetX"
    :offsetY="props.offsetY"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { inject } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import { numMeasuresInjectionKey } from "@/components/Sing/ScoreSequencer.vue";

defineOptions({
  name: "SequencerGrid",
});

const props = defineProps<{
  offsetX: number;
  offsetY: number;
}>();

const injectedValue = inject(numMeasuresInjectionKey);
if (injectedValue == undefined) {
  throw new Error("injectedValue is undefined.");
}
const { numMeasures } = injectedValue;

const store = useStore();

const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const sequencerZoomY = computed(() => store.state.sequencerZoomY);
const sequencerSnapType = computed(() => store.state.sequencerSnapType);
</script>
