<template>
  <div>
    <div class="parameter-header">
      <label :for="`parameter-${sliderKey}`" class="parameter-label">
        {{ label }}
      </label>
      <input
        :id="`parameter-${sliderKey}`"
        :value="innerValueFixed"
        class="parameter-input"
        type="text"
        @change="handleInputChange"
      />
    </div>
    <BaseSlider
      v-model="innerValue"
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

const innerValue = ref(props.modelValue);
watchEffect(() => {
  innerValue.value = props.modelValue;
});
const innerValueFixed = computed(() => innerValue.value.toFixed(2));

const emit = defineEmits<{
  /** 値が確定したタイミングで実行される */
  "update:modelValue": [value: number];
}>();

const handleInputChange = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) {
    throw new Error("Event target is not an HTMLInputElement");
  }

  const rawValue = Number(event.target.value);
  if (Number.isNaN(rawValue)) {
    event.target.value = innerValueFixed.value;
    return;
  }

  const value = Math.min(Math.max(rawValue, props.min), props.max);
  emit("update:modelValue", value);
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
