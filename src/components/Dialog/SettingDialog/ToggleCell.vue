<!-- ON/OFFを切り替えるトグルボタン付きの設定項目 -->

<template>
  <BaseRowCard
    :title
    :description
    clickable
    :disabled="disable"
    tabindex="-1"
    @click="() => $emit('update:modelValue', !modelValue)"
  >
    <BaseSwitch :checked="modelValue" :disabled="disable" />
  </BaseRowCard>
</template>

<script setup lang="ts">
import BaseRowCard from "../../Base/BaseRowCard.vue";
import BaseSwitch from "../../Base/BaseSwitch.vue";

defineProps<{
  title: string;
  description: string;
  modelValue: boolean;
  disable?: boolean;
}>();

defineEmits<{
  "update:modelValue": [payload: boolean];
}>();
</script>
