<template>
  <SliderRoot
    class="SliderRoot"
    :min
    :max
    :step
    :disabled
    :modelValue="[model]"
    @update:modelValue="
      (value) => {
        if (value == undefined) {
          throw new Error('Undefined value received');
        }
        $emit('update:modelValue', value[0]);
      }
    "
  >
    <SliderTrack class="SliderTrack">
      <SliderRange class="SliderRange" />
    </SliderTrack>
    <SliderThumb class="SliderThumb" />
  </SliderRoot>
</template>

<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from "radix-vue";

defineProps<{
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  modelValue: number;
}>();

defineEmits<{
  "update:modelValue": [value: number];
}>();

const model = defineModel<number>({ required: true });
</script>

<style lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;

.SliderRoot {
  position: relative;
  display: flex;
  align-items: center;
  height: vars.$size-control;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  &[data-disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.SliderTrack {
  background-color: colors.$border;
  position: relative;
  flex-grow: 1;
  border-radius: 9999px;
  height: 4px;
}

.SliderRange {
  position: absolute;
  background-color: colors.$primary;
  border-radius: 9999px;
  height: 100%;
}

.SliderThumb {
  display: block;
  width: 8px;
  height: vars.$size-indicator;
  background-color: colors.$primary;
  border: 1px solid colors.$border;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  border-radius: vars.$radius-1;

  :hover:not([data-disabled]) > & {
    background-color: colors.$primary-hovered;
  }

  :active:not([data-disabled]) > & {
    background-color: colors.$primary-pressed;
    box-shadow: 0 0 0 transparent;
  }

  &:focus-visible {
    @include mixin.on-focus;
  }
}
</style>
