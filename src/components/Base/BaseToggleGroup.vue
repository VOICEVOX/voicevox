<template>
  <ToggleGroupRoot
    :modelValue
    class="ToggleGroup"
    :type
    :disabled
    @update:modelValue="
      (val) => {
        if (props.canDeselect || typeof val !== 'undefined') {
          modelValue = val as T;
        }
      }
    "
  >
    <slot />
  </ToggleGroupRoot>
</template>

<script setup lang="ts" generic="T extends AcceptableValue">
import { AcceptableValue, ToggleGroupRoot } from "reka-ui";

const props = defineProps<{
  type: "single" | "multiple";
  disabled?: boolean;
  canDeselect?: boolean;
}>();

const modelValue = defineModel<T | T[]>();
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;

.ToggleGroup {
  display: inline-flex;
}
</style>
