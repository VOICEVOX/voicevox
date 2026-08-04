<template>
  <ToggleGroupRoot
    :modelValue
    class="ToggleGroup"
    :type="rekaType"
    :disabled
    @update:modelValue="
      (val) => {
        if (!(props.type === 'single' && val == undefined)) {
          modelValue = val as T | T[];
        }
      }
    "
  >
    <slot />
  </ToggleGroupRoot>
</template>

<script setup lang="ts" generic="T extends AcceptableValue">
import { type AcceptableValue, ToggleGroupRoot } from "reka-ui";
import { computed } from "vue";

const props = defineProps<{
  type: "single" | "optionalSingle" | "multiple";
  disabled?: boolean;
}>();

const modelValue = defineModel<T | T[]>();

const rekaType = computed(() => {
  if (props.type === "optionalSingle") {
    return "single";
  }
  return props.type;
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;

.ToggleGroup {
  display: inline-flex;
}
</style>
