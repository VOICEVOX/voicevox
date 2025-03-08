<template>
  <CommonDialog
    v-model="modelValue"
    :title="props.mode === 'add' ? '拍子の追加' : '拍子の編集'"
    name="拍子"
    :mode="props.mode"
    @ok="() => $emit('ok', { timeSignatureChange })"
    @hide="() => $emit('hide')"
  >
    <QInput
      v-model.number="timeSignatureChange.beats"
      type="number"
      min="1"
      max="32"
      dense
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
import { ref } from "vue";
import CommonDialog from "./CommonDialog.vue";
import { TimeSignature } from "@/store/type";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
import { BEAT_TYPES } from "@/sing/domain";

const modelValue = defineModel<boolean>();
const props = defineProps<{
  timeSignatureChange: Omit<TimeSignature, "measureNumber">;
  mode: "add" | "edit";
}>();
defineEmits({
  ...useDialogPluginComponent.emitsObject,
});

const timeSignatureChange = ref(
  cloneWithUnwrapProxy(props.timeSignatureChange),
);

const beatTypeOptions = BEAT_TYPES.map((beatType) => ({
  label: beatType.toString(),
  value: beatType,
}));
</script>

<style scoped lang="scss">
.value-input {
  width: 60px;
}
</style>
