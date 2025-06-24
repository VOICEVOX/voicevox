<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <Transition name="overlay">
        <DialogOverlay class="DialogOverlay" />
      </Transition>
      <Transition name="content">
        <DialogContent
          class="DialogContent"
          @interactOutside="persistent ? $event.preventDefault() : hide()"
        >
          <DialogTitle class="DialogTitle">
            <!-- 暫定でQIconを使用 -->
            <QIcon
              v-if="icon"
              :name="icon.name"
              :color="icon.color"
              size="sm"
            />
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
} from "reka-ui";

defineProps<{
  title: string;
  description: string;
  icon?: { name: string; color: string };
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
  // TODO: QDialogを上回るz-indexにするため値を直書き。置き換え後 vars.$z-index-dialog へ変更する。
  z-index: 6000;
}

.DialogContent {
  position: fixed;
  inset: vars.$padding-2;
  min-width: 240px;
  max-width: 480px;
  width: fit-content;
  height: fit-content;
  display: flex;
  flex-direction: column;
  margin: auto;
  padding: vars.$padding-2;
  gap: vars.$gap-1;
  color: colors.$display;
  background-color: colors.$background;
  border: 1px solid colors.$border;
  border-radius: vars.$radius-2;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
  // TODO: QDialogを上回るz-indexにするため値を直書き。置き換え後 vars.$z-index-dialog へ変更する。
  z-index: 6000;
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
