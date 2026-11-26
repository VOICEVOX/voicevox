<template>
  <ToggleGroupRoot
    :modelValue
    class="song-toggle-group"
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

// のちのち統合する可能性があるため、BaseToggleGroupと共通のpropsとv-modelは揃える
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
@use "@/styles/v2/song-variables" as song-vars;

.song-toggle-group {
  display: inline-flex;
  align-items: center;
  height: song-vars.$size-control-small;
  padding: 3px;
  border-radius: song-vars.$radius-full;
  background: var(--scheme-color-surface-container-lowest);
}
</style>
