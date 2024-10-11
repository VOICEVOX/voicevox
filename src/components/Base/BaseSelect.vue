<template>
  <SelectRoot v-model="model" v-model:open="open" :defaultValue :disabled>
    <SelectTrigger class="SelectTrigger">
      <SelectValue class="SelectValue" :placeholder />
      <SelectIcon class="SelectIcon">
        <!-- 暫定でq-iconを使用 -->
        <QIcon name="keyboard_arrow_down" size="sm" />
      </SelectIcon>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        class="SelectContent"
        position="popper"
        :collisionPadding="8"
        :arrowPadding="16"
        avoidCollisions
        hideWhenDetached
      >
        <SelectViewport>
          <slot />
        </SelectViewport>
        <!-- Radix Vue側でエラーが発生するため一時的にコメントアウト -->
        <!-- <SelectArrow class="SelectArrow" /> -->
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script setup lang="ts">
import {
  SelectContent,
  SelectPortal,
  SelectRoot,
  SelectIcon,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from "radix-vue";

defineProps<{
  placeholder?: string;
  defaultValue?: string;
  disabled?: boolean;
}>();

const model = defineModel<string>();
const open = defineModel<boolean>("open");
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;

.SelectTrigger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: vars.$size-control;
  border-radius: vars.$radius-1;
  padding-inline: vars.$padding-2 vars.$padding-1;
  gap: vars.$gap-1;
  border: 1px solid;
  text-align: start;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  color: colors.$display;
  border-color: colors.$border;
  background-color: colors.$control;

  &:hover:not([data-disabled]) {
    background-color: colors.$control-hovered;
  }

  &:active:not([data-disabled]) {
    background-color: colors.$control-pressed;
    box-shadow: 0 0 0 transparent;
  }

  &:focus-visible {
    @include mixin.on-focus;
  }

  &[data-placeholder] {
    color: colors.$display-sub;
  }
}

.SelectIcon {
  color: colors.$display;
}

:deep(.SelectContent) {
  overflow: hidden;
  border-radius: vars.$radius-2;
  padding: vars.$padding-1;
  color: colors.$display;
  background-color: colors.$background;
  border: 1px solid colors.$border;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  min-width: var(--radix-select-trigger-width);
  max-width: var(--radix-select-content-available-width);
  max-height: var(--radix-select-content-available-height);
  z-index: vars.$z-index-dropdown;
}

:deep(.SelectArrow) {
  fill: colors.$background;
  margin-top: -1px;
  filter: drop-shadow(0 1px 0px colors.$border);
}
</style>
