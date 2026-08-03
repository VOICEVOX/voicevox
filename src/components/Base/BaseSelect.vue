<template>
  <SelectRoot v-model="model" v-model:open="open" :defaultValue :disabled>
    <SelectTrigger class="SelectTrigger" :aria-label>
      <div class="SelectValueContainer">
        <SelectValue class="SelectValue" :placeholder>
          <template #default="scope">
            <slot name="value" v-bind="scope">
              {{
                scope.selectedLabel.length > 0
                  ? scope.selectedLabel.join(", ")
                  : placeholder
              }}
            </slot>
          </template>
        </SelectValue>
      </div>
      <SelectIcon v-if="!hideIcon" class="SelectIcon">
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
        <SelectArrow class="SelectArrow" />
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script setup lang="ts" generic="T extends AcceptableValue">
import {
  SelectContent,
  SelectPortal,
  SelectRoot,
  SelectIcon,
  SelectTrigger,
  SelectValue,
  SelectViewport,
  SelectArrow,
  type AcceptableValue,
} from "reka-ui";

defineProps<{
  placeholder?: string;
  defaultValue?: T;
  disabled?: boolean;
  ariaLabel?: string;
  hideIcon?: boolean;
}>();

const model = defineModel<T>();
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

.SelectValueContainer {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.SelectValue {
  max-width: 100%;
}

:deep(.SelectContent) {
  overflow: hidden;
  border-radius: vars.$radius-2;
  padding: vars.$padding-1;
  color: colors.$display;
  background-color: colors.$background;
  border: 1px solid colors.$border;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  min-width: var(--reka-select-trigger-width);
  max-width: var(--reka-select-content-available-width);
  max-height: var(--reka-select-content-available-height);
  z-index: vars.$z-index-dropdown;
}

:deep(.SelectArrow) {
  fill: colors.$background;
  margin-top: -1px;
  filter: drop-shadow(0 1px 0px colors.$border);
}
</style>
