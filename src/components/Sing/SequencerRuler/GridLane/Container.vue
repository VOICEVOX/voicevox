<template>
  <Presentation
    :tpqn
    :sequencerZoomX
    :numMeasures
    :timeSignatures
    :tsPositions
    :offset
    :width="rulerWidth"
    :endTicks
    :measureInfos
  />
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import {
  useSequencerLayout,
  offsetKey,
  numMeasuresKey,
} from "@/composables/useSequencerLayout";
import { SEQUENCER_MIN_NUM_MEASURES } from "@/sing/viewHelper";

defineOptions({
  name: "GridLaneContainer",
});

const store = useStore();

// SequencerRulerのContainerからprovideされる想定だが、
// コンポーネント単位で個別テスト可能にするのと初期化タイミング問題があったためデフォルト値をセットしておく
const offset = inject(offsetKey, ref(0));
const numMeasures = inject(numMeasuresKey, ref(SEQUENCER_MIN_NUM_MEASURES));

const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const playheadPosition = computed(() => store.getters.PLAYHEAD_POSITION);

const { rulerWidth, tsPositions, endTicks, measureInfos } = useSequencerLayout({
  timeSignatures,
  tpqn,
  playheadPosition,
  sequencerZoomX,
  offset,
  numMeasures,
});
</script>
