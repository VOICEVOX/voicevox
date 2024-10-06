<template>
  <label class="root">
    <CheckboxRoot v-model:checked="checked" class="CheckboxRoot">
      <CheckboxIndicator class="CheckboxIndicator">
        <QIcon class="check" name="check" />
      </CheckboxIndicator>
    </CheckboxRoot>
    {{ label }}
  </label>
</template>

<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot } from "radix-vue";

defineProps<{ label: string }>();

const checked = defineModel<boolean>("checked");
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/colors" as colors;

.root {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: vars.$gap-1;
  cursor: pointer;
}

:deep(.CheckboxRoot) {
  padding: 0;
  background-color: colors.$background;
  height: vars.$size-indicator;
  width: vars.$size-indicator;
  border: 1px solid colors.$border;
  border-radius: vars.$radius-1;
  color: white;
  cursor: pointer;

  &[data-state="checked"] {
    background-color: colors.$primary;
  }

  &:focus-visible {
    @include mixin.on-focus;
  }
}

.CheckboxIndicator {
  display: grid;
  place-items: center;
}
</style>
