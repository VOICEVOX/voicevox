<template>
  <Presentation
    :tpqn
    :sequencerZoomX
    :numMeasures
    :timeSignatures
    :tsPositions
    :offset
    :width
    :endTicks
  />
</template>

<script setup lang="ts">
import { inject } from "vue";
import { sequencerRulerInjectionKey } from "../Container.vue";
import Presentation from "./Presentation.vue";

defineOptions({
  name: "GridLaneContainer",
});

const injectedValue = inject(sequencerRulerInjectionKey);
if (injectedValue == undefined) {
  throw new Error("injectedValue is undefined.");
}

const {
  tsPositions,
  width,
  endTicks,
  sequencerZoomX,
  tpqn,
  timeSignatures,
  numMeasures,
  offset,
} = injectedValue;
</script>
