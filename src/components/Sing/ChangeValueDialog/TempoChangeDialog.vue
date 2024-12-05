<template>
  <CommonDialog
    v-model="modelValue"
    :title="props.mode === 'add' ? 'テンポの追加' : 'テンポの編集'"
    name="テンポ"
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
      aria-label="テンポ"
    />
  </CommonDialog>
</template>

<script setup lang="ts">
import { QInput, useDialogPluginComponent } from "quasar";
import { ref } from "vue";
import CommonDialog from "./CommonDialog.vue";
import { Tempo } from "@/store/type";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";

const modelValue = defineModel<boolean>();
const props = defineProps<{
  tempoChange: Omit<Tempo, "position">;
  mode: "add" | "edit";
}>();
defineEmits({
  ...useDialogPluginComponent.emitsObject,
});

const tempoChange = ref(cloneWithUnwrapProxy(props.tempoChange));
</script>

<style scoped lang="scss">
.value-input {
  width: 60px;
}
</style>
