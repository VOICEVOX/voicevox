<template>
  <CommonDialog
    v-model="modelValue"
    title="拍子の変更"
    name="拍子"
    :mode="props.mode"
    @ok="() => $emit('ok', { timeSignatureChange })"
    @hide="() => $emit('hide')"
  >
    <QSelect
      v-model="timeSignatureChange.beats"
      :options="beatsOptions"
      mapOptions
      emitValue
      dense
      userInputs
      optionsDense
      transitionShow="none"
      transitionHide="none"
      class="value-input"
      aria-label="拍子の分子"
    />
    <div class="q-px-sm">/</div>
    <QSelect
      v-model="timeSignatureChange.beatType"
      :options="beatTypeOptions"
      mapOptions
      emitValue
      dense
      userInputs
      optionsDense
      transitionShow="none"
      transitionHide="none"
      class="value-input"
      aria-label="拍子の分母"
    />
  </CommonDialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from "quasar";
import { computed, ref } from "vue";
import CommonDialog from "./CommonDialog.vue";
import { TimeSignature } from "@/store/type";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
import { BEAT_TYPES, DEFAULT_BEAT_TYPE, DEFAULT_BEATS } from "@/sing/domain";

const modelValue = defineModel<boolean>();
const props = defineProps<{
  timeSignatureChange: Omit<TimeSignature, "measureNumber"> | undefined;
  mode: "add" | "edit";
}>();
defineEmits({
  ...useDialogPluginComponent.emitsObject,
});

const timeSignatureChange = ref(
  cloneWithUnwrapProxy(props.timeSignatureChange) || {
    beats: DEFAULT_BEATS,
    beatType: DEFAULT_BEAT_TYPE,
  },
);

const beatsOptions = computed(() => {
  return Array.from({ length: 32 }, (_, i) => ({
    label: (i + 1).toString(),
    value: i + 1,
  }));
});

const beatTypeOptions = BEAT_TYPES.map((beatType) => ({
  label: beatType.toString(),
  value: beatType,
}));
</script>

<style scoped lang="scss">
.dialog-card {
  width: 700px;
  max-width: 80vw;
}

.value-input {
  width: 60px;
}
</style>
