<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger v-bind="$attrs" asChild>
      <slot />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        class="song-popover"
        side="bottom"
        align="start"
        :sideOffset="4"
        avoidCollisions
        :collisionPadding="8"
      >
        <slot name="content" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup lang="ts">
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from "reka-ui";

// スロットに入れたボタンなどに、親から渡したclassやイベントを付与するための設定
// Vueは渡された属性をコンポーネントのルートに付けるが、ルートのPopoverRootは要素を描画しないので、そのままではスロットの要素も含めどこにも付かない
// そこで自動で付けるのを止め、PopoverTriggerにv-bind="$attrs"で渡して、asChildでスロットの要素に付ける
defineOptions({
  inheritAttrs: false,
});

const open = defineModel<boolean>("open");
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/song-variables" as song-vars;
@use "@/styles/v2/song-mixin" as song-mixin;

:deep(.song-popover) {
  @include song-mixin.popup-surface;
  padding: song-vars.$space-16;
  border-radius: song-vars.$radius-12;
  box-shadow: song-vars.$shadow-popup;
  z-index: vars.$z-index-dropdown;
}
</style>
