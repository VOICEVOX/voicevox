<template>
  <div class="phoneme-timing-editor">
    <div class="axis-area"></div>
    <div v-if="editTarget === 'PHONEME_TIMING'" class="parameter-area">
      <SequencerParameterGrid
        class="parameter-grid"
        :offsetX="props.viewportInfo.offsetX"
      />
      <SequencerWaveform
        class="waveform"
        :offsetX="props.viewportInfo.offsetX"
      />
      <SequencerNoteTimings
        class="note-timings"
        :offsetX="props.viewportInfo.offsetX"
        :offsetY="props.viewportInfo.offsetY"
      />
      <SequencerPhonemeTimings
        class="phoneme-timings"
        :offsetX="props.viewportInfo.offsetX"
        :offsetY="props.viewportInfo.offsetY"
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

const store = useStore();
const editTarget = computed(() => store.state.parameterPanelEditTarget);
const props = defineProps<{
  viewportInfo: ViewportInfo;
}>();
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
