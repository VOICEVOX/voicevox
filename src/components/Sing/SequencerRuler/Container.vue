<template>
  <Presentation
    :width
    :numMeasures="props.numMeasures"
    :playheadX
    :playheadTicks
    :offset="props.offset"
    :tempos
    :timeSignatures
    :tpqn
    :sequencerZoomX
    :sequencerSnapType
    :getSnappedTickFromOffsetX
    :uiLocked
    @update:playheadTicks="updatePlayheadTicks"
    @deselectAllNotes="deselectAllNotes"
  >
    <!-- TODO: 各コンポーネントもなるべく疎にしたつもりだが、少なくともplayheadまわりがリファクタリング必要そう -->
    <template #grid>
      <GridLaneContainer
        :numMeasures="props.numMeasures"
        :offset="props.offset"
      />
    </template>
    <template #changes>
      <ValueChangesLaneContainer
        :offset="props.offset"
        :numMeasures="props.numMeasures"
        @setPlayheadPosition="updatePlayheadTicks"
      />
    </template>
    <template #loop>
      <LoopLaneContainer
        :offset="props.offset"
        :numMeasures="props.numMeasures"
      />
    </template>
  </Presentation>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Presentation from "./Presentation.vue";
import GridLaneContainer from "./GridLane/Container.vue";
import ValueChangesLaneContainer from "./ValueChangesLane/Container.vue";
import LoopLaneContainer from "./LoopLane/Container.vue";
import { useStore } from "@/store";
import { useSequencerRuler } from "@/composables/useSequencerRuler";

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
const timeSignatures = computed(() => store.state.timeSignatures);
const tempos = computed(() => store.state.tempos);
const sequencerZoomX = computed(() => store.state.sequencerZoomX);
const sequencerSnapType = computed(() => store.state.sequencerSnapType);
const playheadTicks = computed(() => store.getters.PLAYHEAD_POSITION);
const uiLocked = computed(() => store.getters.UI_LOCKED);

// ルーラーおよび内部レーンで共通化した計算ロジック
const { width, playheadX, getSnappedTickFromOffsetX } = useSequencerRuler({
  offset: computed(() => props.offset),
  numMeasures: computed(() => props.numMeasures),
  tpqn,
  timeSignatures,
  sequencerZoomX,
  playheadTicks,
  sequencerSnapType,
});

// NOTE: usePlayheadPositionができたら再生ヘッド周辺を置き換える
const updatePlayheadTicks = (ticks: number) => {
  void store.actions.SET_PLAYHEAD_POSITION({ position: ticks });
};

const deselectAllNotes = () => {
  void store.actions.DESELECT_ALL_NOTES();
};
</script>
