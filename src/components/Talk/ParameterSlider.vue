<template>
  <div>
    <div class="parameter-header">
      <label :for="`parameter-${sliderKey}`" class="parameter-label">
        {{ label }}
      </label>
      <input
        :id="`parameter-${sliderKey}`"
        :value="inputValueFixed"
        class="parameter-input"
        type="text"
        @change="onUpdate"
        @blur="onUpdate"
      />
    </div>
    <BaseSlider
      v-model="inputValue"
      :min
      :max
      :step
      :scrollStep
      @valueCommit="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import BaseSlider from "@/components/Base/BaseSlider.vue";

const props = defineProps<{
  sliderKey: string;
  min: number;
  max: number;
  step: number;
  scrollStep: number;
  label: string;
  modelValue: number;
}>();

const inputValue = ref(props.modelValue);
watchEffect(() => {
  inputValue.value = props.modelValue;
});
const inputValueFixed = computed(() => inputValue.value.toFixed(2));

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

const onUpdate = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) {
    return;
  }

  const value = Number(event.target.value);
  if (!Number.isNaN(value)) {
    emit("update:modelValue", Math.min(Math.max(value, props.min), props.max));
  }

  inputValue.value = props.modelValue;
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;

.parameter-header {
  display: flex;
  justify-content: space-between;
}

.parameter-input {
  border: none;
  width: 64px;
  background-color: transparent;
  text-align: right;
  border-radius: vars.$radius-1;
  color: colors.$display;

  &:focus-visible {
    @include mixin.on-focus;
  }
}
</style>
