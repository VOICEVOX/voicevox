<!-- ON/OFFを切り替えるトグルボタン付きの設定項目 -->

<template>
  <BaseCell :title :description>
    <QToggle :modelValue @update:modelValue="props['onUpdate:modelValue']">
      <slot />
    </QToggle>
  </BaseCell>
</template>

<script setup lang="ts">
import BaseCell, { Props } from "./BaseCell.vue";

const props = defineProps<
  Props & {
    modelValue: boolean;
    // eslint-disable-next-line vue/prop-name-casing
    "onUpdate:modelValue"?: (value: boolean) => void;
  }
>();
</script>
