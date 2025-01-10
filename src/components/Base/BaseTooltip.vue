<template>
  <TooltipRoot :disabled>
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
  disabled?: boolean;
}>();
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;

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
  z-index: vars.$z-index-tooltip;
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
  margin-top: -1px;
  filter: drop-shadow(0 1px 0px colors.$border);
}
</style>
