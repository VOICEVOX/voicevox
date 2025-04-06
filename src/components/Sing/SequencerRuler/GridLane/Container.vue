<template>
  <Presentation
    :tpqn
    :sequencerZoomX
    :numMeasures="numMeasures.value"
    :offset="injectedOffset"
    :timeSignatures
    :tsPositions
    :width="rulerWidth"
    :endTicks
    :measureInfos
  />
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { numMeasuresInjectionKey } from "../../ScoreSequencer.vue";
import { offsetInjectionKey } from "../Container.vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";
import { useSequencerLayout } from "@/composables/useSequencerLayout";
import { SEQUENCER_MIN_NUM_MEASURES } from "@/sing/viewHelper";

defineOptions({
  name: "GridLaneContainer",
});

const store = useStore();

// SequencerRulerのContainerからprovideされる想定だが、
// コンポーネント単位で個別テスト可能にするのと初期化タイミング問題があったためデフォルト値をセットしておく
const injectedOffset = inject(offsetInjectionKey, ref(0));
const injectedNumMeasures = inject(numMeasuresInjectionKey, {
  numMeasures: computed(() => SEQUENCER_MIN_NUM_MEASURES),
});

const numMeasures = computed(() => injectedNumMeasures.numMeasures);

const tpqn = computed(() => store.state.tpqn);
const timeSignatures = computed(() => store.state.timeSignatures);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const playheadPosition = computed(() => store.getters.PLAYHEAD_POSITION);

const { rulerWidth, tsPositions, endTicks, measureInfos } = useSequencerLayout({
  timeSignatures,
  tpqn,
  playheadPosition,
  sequencerZoomX,
  offset: injectedOffset,
  numMeasures: numMeasures.value,
});
</script>
