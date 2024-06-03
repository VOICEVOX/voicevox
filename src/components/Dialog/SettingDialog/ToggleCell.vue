<template>
  <BaseCell :title="title" :description="description">
    <QToggle :model-value="modelValue" @update:model-value="onUpdated">
    </QToggle>
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
