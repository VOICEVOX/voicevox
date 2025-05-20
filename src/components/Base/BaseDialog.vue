<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <Transition name="overlay">
        <DialogOverlay class="DialogOverlay" />
      </Transition>
      <Transition name="content">
        <DialogContent
          class="DialogContent"
          @interactOutside="persistent && $event.preventDefault()"
        >
          <DialogTitle class="DialogTitle">
            <QIcon v-if="icon" :name="icon" size="sm" />
            {{ title }}
          </DialogTitle>
          <DialogDescription class="DialogDescription">
            {{ description }}
          </DialogDescription>
          <slot />
        </DialogContent>
      </Transition>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogDescription,
} from "radix-vue";

defineProps<{
  title: string;
  description: string;
  icon?: string;
  persistent?: boolean;
}>();

const open = defineModel<boolean>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const show = () => emit("update:open", true);
const hide = () => emit("update:open", false);
defineExpose({
  show,
  hide,
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;

.DialogOverlay {
  position: fixed;
  inset: 0;
  top: 24px;
  background-color: rgba($color: #000000, $alpha: 0.4);
  z-index: 6000;
}

.DialogContent {
  position: fixed;
  inset: vars.$padding-2;
  width: fit-content;
  min-width: 240px;
  max-width: 480px;
  height: fit-content;
  margin: auto;
  display: grid;
  grid-template-rows: auto 1fr;
  z-index: 6000;
  display: flex;
  flex-direction: column;
  gap: vars.$gap-1;
  color: colors.$display;
  background-color: colors.$background;
  border: 1px solid colors.$border;
  padding: vars.$padding-2;
  border-radius: vars.$radius-2;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
}

.DialogTitle {
  @include mixin.headline-2;
  display: flex;
  align-items: center;
  gap: vars.$gap-1;
}

.DialogDescription {
  white-space: pre-wrap;
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity vars.$transition-duration;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.content-enter-active,
.content-leave-active {
  transition:
    opacity vars.$transition-duration,
    transform vars.$transition-duration;
}

.content-enter-from,
.content-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
