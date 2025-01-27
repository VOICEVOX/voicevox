<template>
  <Presentation v-bind="$props" />
</template>

<script setup lang="ts">
import Presentation from "./Presentation.vue";
import { TimeSignature } from "@/store/type";

defineOptions({
  name: "GridLaneContainer",
});

defineProps<{
  tpqn: number;
  sequencerZoomX: number;
  numMeasures: number;
  timeSignatures: TimeSignature[];
  offset: number;
}>();
</script>
