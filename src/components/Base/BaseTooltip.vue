<template>
  <TooltipRoot>
    <TooltipTrigger asChild>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <Transition>
        <TooltipContent
          class="TooltipContent"
          :sideOffset="4"
          avoidCollisions
          :collisionPadding="8"
        >
          {{ label }}
          <TooltipArrow class="TooltipArrow" />
        </TooltipContent>
      </Transition>
    </TooltipPortal>
  </TooltipRoot>
</template>

<script setup lang="ts">
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipRoot,
  TooltipTrigger,
} from "radix-vue";

defineProps<{
  label: string;
}>();
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/colors" as colors;

[data-radix-popper-content-wrapper] {
  z-index: 9999 !important;
}

:deep(.TooltipContent) {
  display: flex;
  align-items: center;
  border-radius: vars.$radius-1;
  height: 32px;
  padding: 0 8px;
  color: colors.$display;
  background-color: colors.$background;
  border: 1px solid colors.$border;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  user-select: none;
  transform-origin: var(--radix-tooltip-content-transform-origin);
  will-change: transform, opacity;
}

.v-enter-active,
.v-leave-active {
  transition: opacity vars.$transition-duration;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}

:deep(.TooltipArrow) {
  fill: colors.$background;
  stroke: colors.$border;
  paint-order: stroke;
  stroke-width: 2px;
}
</style>
