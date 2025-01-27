<template>
  <Presentation v-bind="$props" @valueChangeClick="onValueChangeClick" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Dialog } from "quasar";
import Presentation from "./Presentation.vue";
import { Tempo, TimeSignature } from "@/store/type";
import { tickToMeasureNumber } from "@/sing/domain";
import TempoChangeDialog from "@/components/Sing/ChangeValueDialog/TempoChangeDialog.vue";
import TimeSignatureChangeDialog from "@/components/Sing/ChangeValueDialog/TimeSignatureChangeDialog.vue";

defineOptions({
  name: "ValueMarkerLaneContainer",
});

const props = defineProps<{
  tpqn: number;
  sequencerZoomX: number;
  tempos: Tempo[];
  timeSignatures: TimeSignature[];
  offset: number;
  playheadTicks: number;
  uiLocked: boolean;
}>();

const emit = defineEmits<{
  setTempo: [tempo: Tempo];
  removeTempo: [position: number];
  setTimeSignature: [timeSignature: TimeSignature];
  removeTimeSignature: [measureNumber: number];
}>();

const currentMeasure = computed(() =>
  tickToMeasureNumber(props.playheadTicks, props.timeSignatures, props.tpqn),
);

const currentTempo = computed(() => {
  const maybeTempo = props.tempos.findLast((tempo) => {
    return tempo.position <= props.playheadTicks;
  });
  if (!maybeTempo) {
    throw new Error("At least one tempo exists.");
  }
  return maybeTempo;
});

const currentTimeSignature = computed(() => {
  const maybeTimeSignature = props.timeSignatures.findLast((timeSignature) => {
    return timeSignature.measureNumber <= currentMeasure.value;
  });
  if (!maybeTimeSignature) {
    throw new Error("At least one time signature exists.");
  }
  return maybeTimeSignature;
});

const tempoChangeExists = computed(
  () => currentTempo.value.position === props.playheadTicks,
);

const timeSignatureChangeExists = computed(
  () => currentTimeSignature.value.measureNumber === currentMeasure.value,
);

const onValueChangeClick = async () => {
  if (props.uiLocked) return;

  if (tempoChangeExists.value) {
    Dialog.create({
      component: TempoChangeDialog,
      componentProps: {
        tempoChange: currentTempo.value,
        mode: "edit",
      },
    }).onOk((result: { tempoChange: Omit<Tempo, "position"> }) => {
      emit("setTempo", {
        ...result.tempoChange,
        position: props.playheadTicks,
      });
    });
  } else if (timeSignatureChangeExists.value) {
    Dialog.create({
      component: TimeSignatureChangeDialog,
      componentProps: {
        timeSignatureChange: currentTimeSignature.value,
        mode: "edit",
      },
    }).onOk(
      (result: { timeSignatureChange: Omit<TimeSignature, "position"> }) => {
        emit("setTimeSignature", {
          ...result.timeSignatureChange,
          measureNumber: currentMeasure.value,
        });
      },
    );
  }
};
</script>
