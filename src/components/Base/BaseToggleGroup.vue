<template>
  <ToggleGroupRoot
    class="ToggleGroup"
    :type
    :modelValue
    :disabled
    @update:modelValue="
      (value) => {
        if (value != undefined) {
          $emit('update:modelValue', value);
        }
      }
    "
  >
    <slot />
  </ToggleGroupRoot>
</template>

<script setup lang="ts">
import { ToggleGroupRoot } from "radix-vue";

defineProps<{
  type: "single" | "multiple";
  modelValue: string | string[];
  disabled?: boolean;
}>();

defineEmits<{
  "update:modelValue": [payload: string | string[]];
}>();
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;

.ToggleGroup {
  display: inline-flex;
  background-color: var(--mauve-6);
  border-radius: 4px;
  box-shadow: 0 2px 10px var(--black-a7);
}
</style>
