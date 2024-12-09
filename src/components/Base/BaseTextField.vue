<template>
  <div class="wrapper">
    <input
      v-model="model"
      type="text"
      class="input"
      :class="{ error: hasError }"
      :placeholder
      :readonly
      :disabled
      @click="(payload) => $emit('click', payload)"
    />
    <div v-if="hasError" class="error-label">
      <slot name="error" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  placeholder?: string;
  hasError?: boolean;
  readonly?: boolean;
  disabled?: boolean;
}>();

defineEmits<{
  click: [payload: MouseEvent];
}>();

const model = defineModel<string>();
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;

.wrapper {
  width: 100%;
}

.input {
  height: vars.$size-control;
  width: 100%;
  display: flex;
  align-items: center;
  gap: vars.$gap-1;
  border: 1px solid colors.$border;
  border-radius: vars.$radius-1;
  padding-inline: vars.$padding-1;
  background-color: colors.$control;
  color: colors.$display;

  &:focus {
    @include mixin.on-focus;
  }

  &:disabled {
    opacity: 0.5;
  }

  &::placeholder {
    color: colors.$display-sub;
  }
}

.error {
  border: 2px solid colors.$display-warning;
}

.error-label {
  color: colors.$display-warning;
}
</style>
