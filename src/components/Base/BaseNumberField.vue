<template>
  <div class="NumberField">
    <label class="NumberFieldLabel" :for="inputId">{{ label }}</label>
    <NumberFieldRoot
      :id="inputId"
      v-model="draftValue"
      class="NumberFieldControl"
      :min
      :max
      :step
      :disabled
      disableWheelChange
      @focusout="handleFocusOut"
    >
      <NumberFieldInput
        :id="inputId"
        class="NumberFieldInput"
        @keydown.enter="commit"
      />
      <div class="NumberFieldButtons">
        <NumberFieldDecrement
          type="button"
          class="NumberFieldButton"
          :aria-label="`${label}を${step}減らす`"
          @click="commitAfterButtonOperation"
        >
          <span
            class="NumberFieldIcon material-symbols-outlined"
            aria-hidden="true"
          >
            remove
          </span>
        </NumberFieldDecrement>
        <NumberFieldIncrement
          type="button"
          class="NumberFieldButton"
          :aria-label="`${label}を${step}増やす`"
          @click="commitAfterButtonOperation"
        >
          <span
            class="NumberFieldIcon material-symbols-outlined"
            aria-hidden="true"
          >
            add
          </span>
        </NumberFieldIncrement>
      </div>
    </NumberFieldRoot>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, useId, watch } from "vue";
import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot,
} from "reka-ui";

const props = withDefaults(
  defineProps<{
    label: string;
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
  }>(),
  {
    min: undefined,
    max: undefined,
    step: 1,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

const inputId = useId();
const draftValue = ref(props.modelValue);
const lastCommittedValue = ref(props.modelValue);

watch(
  () => props.modelValue,
  (value) => {
    draftValue.value = value;
    lastCommittedValue.value = value;
  },
);

const commit = () => {
  const value = draftValue.value;
  if (
    !Number.isFinite(value) ||
    (props.min != undefined && value < props.min) ||
    (props.max != undefined && value > props.max)
  ) {
    draftValue.value = props.modelValue;
    return;
  }
  if (value === lastCommittedValue.value) {
    return;
  }
  lastCommittedValue.value = value;
  emit("update:modelValue", value);
};

const handleFocusOut = (event: FocusEvent) => {
  const currentTarget = event.currentTarget;
  const relatedTarget = event.relatedTarget;
  if (
    currentTarget instanceof HTMLElement &&
    relatedTarget instanceof Node &&
    currentTarget.contains(relatedTarget)
  ) {
    return;
  }
  commit();
};

const commitAfterButtonOperation = async () => {
  await nextTick();
  commit();
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;

.NumberField {
  display: grid;
  gap: 4px;
}

.NumberFieldLabel {
  color: colors.$display-sub;
  font-size: 12px;
  line-height: 12px;
}

.NumberFieldControl {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  height: vars.$size-control;
  overflow: hidden;
  border: 1px solid colors.$border;
  border-radius: vars.$radius-1;
  color: colors.$display;
  background-color: colors.$control;

  &:focus-within {
    @include mixin.on-focus;
  }

  &[data-disabled] {
    cursor: default;
    opacity: 0.5;
  }
}

.NumberFieldInput {
  width: 100%;
  min-width: 0;
  padding: 0 vars.$padding-2;
  border: none;
  outline: none;
  color: inherit;
  background: transparent;
  font: inherit;
  text-align: left;
}

.NumberFieldButtons {
  display: grid;
  grid-template-columns: vars.$size-control vars.$size-control;
  border-left: 1px solid colors.$border;
}

.NumberFieldButton {
  display: grid;
  place-items: center;
  width: vars.$size-control;
  padding: 0;
  border: none;
  color: colors.$display;
  background-color: colors.$control;
  cursor: pointer;
  font: inherit;

  & + & {
    border-left: 1px solid colors.$border;
  }

  &:hover:not([data-disabled]) {
    background-color: colors.$control-hovered;
  }

  &:active:not([data-disabled]) {
    background-color: colors.$control-pressed;
  }

  &:focus-visible {
    @include mixin.on-focus;
    outline-offset: -2px;
  }

  &[data-disabled] {
    cursor: default;
    opacity: 0.5;
  }
}

.NumberFieldIcon {
  font-size: 20px;
}
</style>
