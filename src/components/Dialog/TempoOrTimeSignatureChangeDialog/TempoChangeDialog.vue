<template>
  <CommonDialog
    v-model="modelValue"
    title="BPMの変更"
    name="BPM"
    :mode="props.mode"
    @ok="() => $emit('ok', { tempoChange })"
    @hide="() => $emit('hide')"
  >
    <QInput
      v-model.number="tempoChange.bpm"
      type="number"
      dense
      hideBottomSpace
      class="value-input"
      aria-label="BPM"
    />
  </CommonDialog>
</template>

<script setup lang="ts">
import { QInput, useDialogPluginComponent } from "quasar";
import { ref } from "vue";
import CommonDialog from "./CommonDialog.vue";
import { Tempo } from "@/store/type";
import { DEFAULT_BPM } from "@/sing/domain";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";

const modelValue = defineModel<boolean>();
const props = defineProps<{
  tempoChange: Omit<Tempo, "position"> | undefined;
  mode: "add" | "edit";
}>();
defineEmits({
  ...useDialogPluginComponent.emitsObject,
});

const tempoChange = ref(
  cloneWithUnwrapProxy(props.tempoChange) || {
    bpm: DEFAULT_BPM,
  },
);
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
