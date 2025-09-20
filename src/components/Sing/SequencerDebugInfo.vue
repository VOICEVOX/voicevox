<template>
  <div class="container">
    <div v-if="showPhraseBoundaries">
      <div
        v-for="minNonPauseStartInfo in minNonPauseStartInfos"
        :key="minNonPauseStartInfo.phraseKey"
        class="min-non-pause-start-line"
        :style="{
          transform: `translateX(${minNonPauseStartInfo.baseX * zoomX - offsetX}px)`,
        }"
      ></div>
      <div
        v-for="maxNonPauseEndInfo in maxNonPauseEndInfos"
        :key="maxNonPauseEndInfo.phraseKey"
        class="max-non-pause-end-line"
        :style="{
          transform: `translateX(${maxNonPauseEndInfo.baseX * zoomX - offsetX}px)`,
        }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";
import { secondToTick } from "@/sing/domain";
import { getOrThrow } from "@/helpers/mapHelper";
import { tickToBaseX } from "@/sing/viewHelper";
import { PhraseKey } from "@/store/type";

type PhraseInfo = {
  startTime: number;
  minNonPauseStartTicks: number | undefined;
  maxNonPauseEndTicks: number | undefined;
};

defineProps<{ offsetX: number; showPhraseBoundaries: boolean }>();

const store = useStore();
const state = store.state;
const tpqn = computed(() => state.tpqn);
const tempos = computed(() => state.tempos);
const zoomX = computed(() => state.sequencerZoomX);

const phraseInfosInSelectedTrack = computed(() => {
  const selectedTrackId = store.getters.SELECTED_TRACK_ID;
  const selectedTrack = getOrThrow(state.tracks, selectedTrackId);

  let engineFrameRate: number | undefined = undefined;
  if (selectedTrack.singer != undefined) {
    const engineManifest = state.engineManifests[selectedTrack.singer.engineId];
    engineFrameRate = engineManifest.frameRate;
  }

  const phraseInfos = new Map<PhraseKey, PhraseInfo>();
  for (const [phraseKey, phrase] of store.state.phrases) {
    if (phrase.trackId !== selectedTrackId) {
      continue;
    }

    let minNonPauseStartTicks: number | undefined = undefined;
    if (
      engineFrameRate != undefined &&
      phrase.minNonPauseStartFrame != undefined
    ) {
      const minNonPauseStartTime =
        phrase.startTime + phrase.minNonPauseStartFrame / engineFrameRate;
      minNonPauseStartTicks = secondToTick(
        minNonPauseStartTime,
        tempos.value,
        tpqn.value,
      );
    }

    let maxNonPauseEndTicks: number | undefined = undefined;
    if (
      engineFrameRate != undefined &&
      phrase.maxNonPauseEndFrame != undefined
    ) {
      const maxNonPauseEndTime =
        phrase.startTime + phrase.maxNonPauseEndFrame / engineFrameRate;
      maxNonPauseEndTicks = secondToTick(
        maxNonPauseEndTime,
        tempos.value,
        tpqn.value,
      );
    }

    phraseInfos.set(phraseKey, {
      startTime: phrase.startTime,
      minNonPauseStartTicks,
      maxNonPauseEndTicks,
    });
  }
  return phraseInfos;
});

const minNonPauseStartInfos = computed(() => {
  const infos: { phraseKey: PhraseKey; baseX: number }[] = [];
  for (const [phraseKey, phraseInfo] of phraseInfosInSelectedTrack.value) {
    if (phraseInfo.minNonPauseStartTicks != undefined) {
      const baseX = tickToBaseX(phraseInfo.minNonPauseStartTicks, tpqn.value);
      infos.push({ phraseKey, baseX });
    }
  }
  return infos;
});

const maxNonPauseEndInfos = computed(() => {
  const infos: { phraseKey: PhraseKey; baseX: number }[] = [];
  for (const [phraseKey, phraseInfo] of phraseInfosInSelectedTrack.value) {
    if (phraseInfo.maxNonPauseEndTicks != undefined) {
      const baseX = tickToBaseX(phraseInfo.maxNonPauseEndTicks, tpqn.value);
      infos.push({ phraseKey, baseX });
    }
  }
  return infos;
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;

.container {
  position: relative;
  height: 100%;
}

.min-non-pause-start-line {
  position: absolute;
  top: 0;
  left: -1px;
  width: 2px;
  height: 30px;
  background-color: red;
}

.max-non-pause-end-line {
  position: absolute;
  top: 0;
  left: -1px;
  width: 2px;
  height: 30px;
  background-color: blue;
}
</style>
