<template>
  <div class="root">
    <div class="label">{{ checked ? checkedLabel : uncheckedLabel }}</div>
    <SwitchRoot :id v-model:checked="checked" :disabled class="SwitchRoot">
      <SwitchThumb class="SwitchThumb">
        <QIcon class="check" name="check" />
      </SwitchThumb>
    </SwitchRoot>
  </div>
</template>

<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from "radix-vue";

defineProps<{
  id?: string;
  uncheckedLabel?: string;
  checkedLabel?: string;
  disabled?: boolean;
}>();

const checked = defineModel<boolean>("checked", { required: true });
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/colors" as colors;

.root {
  display: flex;
  align-items: center;
  gap: vars.$gap-1;
}

:deep(.SwitchRoot) {
  cursor: pointer;
  width: 40px;
  padding: 1px;
  height: vars.$size-indicator;
  background-color: colors.$border;
  border: 1px solid colors.$border;
  border-radius: 9999px;
  position: relative;

  &:focus-visible {
    @include mixin.on-focus;
  }

  &[data-state="checked"] {
    background-color: colors.$primary;
  }
}

.SwitchThumb {
  display: grid;
  place-items: center;
  color: transparent;
  width: 20px;
  height: 20px;
  background-color: white;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition:
    transform vars.$transition-duration,
    color vars.$transition-duration;
  will-change: transform;
}

.SwitchThumb[data-state="checked"] {
  transform: translateX(16px);
  color: colors.$primary;
}

.label {
  color: colors.$display;
}
</style>
