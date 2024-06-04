<template>
  <BaseCell :title :description>
    <QToggle :modelValue @update:modelValue="onUpdated"> </QToggle>
  </BaseCell>
</template>

<script setup lang="ts">
import BaseCell, { Props } from "./BaseCell.vue";

defineProps<
  Props & {
    modelValue: boolean;
    onUpdated: (value: boolean) => void;
  }
>();
</script>
