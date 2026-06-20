<template>
  <div class="phoneme-timing-editor">
    <div class="axis-area"></div>
    <div class="parameter-area">
      <SequencerParameterGrid class="parameter-grid" :viewportInfo />
      <SequencerWaveform class="waveform" :viewportInfo />
      <SequencerNoteTimings class="note-timings" :viewportInfo />
      <SequencerPhonemeTimings
        class="phoneme-timings"
        :viewportInfo
        :phonemeTimingInfos
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ViewportInfo } from "@/sing/viewHelper";
import { useStore } from "@/store";
import SequencerParameterGrid from "@/components/Sing/SequencerParameterGrid.vue";
import SequencerWaveform from "@/components/Sing/SequencerWaveform.vue";
import SequencerPhonemeTimings from "@/components/Sing/SequencerPhonemeTimings.vue";
import SequencerNoteTimings from "@/components/Sing/SequencerNoteTimings.vue";
import {
  computePhonemeTimingInfos,
  getPhraseInfosForTrack,
} from "@/sing/phonemeTimingEditorStateMachine/common";

const store = useStore();

defineProps<{
  viewportInfo: ViewportInfo;
}>();

const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);
const phonemeTimingEditData = computed(
  () => store.getters.SELECTED_TRACK.phonemeTimingEditData,
);
const phraseInfos = computed(() =>
  getPhraseInfosForTrack(
    store.state.phrases,
    store.state.phraseQueries,
    selectedTrackId.value,
  ),
);
const phonemeTimingInfos = computed(() => {
  return computePhonemeTimingInfos(
    phraseInfos.value,
    phonemeTimingEditData.value,
  );
});
</script>

<style scoped lang="scss">
.phoneme-timing-editor {
  width: 100%;
  height: 100%;
  overflow: hidden;

  display: grid;
  grid-template-columns: 48px 1fr;
}

.axis-area {
  grid-column: 1;
  grid-row: 1;
  border-right: solid 1px var(--scheme-color-sing-piano-keys-right-border);
}

.parameter-area {
  grid-column: 2;
  grid-row: 1;
  overflow: hidden;
  position: relative;

  display: grid;
  grid-template-rows: 12px 26px 28px 1fr;
}

.parameter-grid {
  grid-column: 1;
  grid-row: 1 / 5;
}

.waveform {
  grid-column: 1;
  grid-row: 4 / 5;
}

.note-timings {
  grid-column: 1;
  grid-row: 2 / 3;
}

.phoneme-timings {
  grid-column: 1;
  grid-row: 1 / 5;
}
</style>
