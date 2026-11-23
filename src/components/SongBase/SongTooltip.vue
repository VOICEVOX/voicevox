<template>
  <TooltipRoot :disabled :open>
    <TooltipTrigger v-bind="$attrs" asChild>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        class="song-tooltip"
        :side
        :sideOffset="8"
        :updatePositionStrategy
        avoidCollisions
        :collisionPadding="8"
      >
        {{ label }}
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>

<script setup lang="ts">
import {
  TooltipContent,
  TooltipPortal,
  TooltipRoot,
  TooltipTrigger,
} from "reka-ui";

// スロットに入れたボタンなどに、親から渡したclassやイベントを付与するための設定
// Vueは渡された属性をコンポーネントのルートに付けるが、ルートのTooltipRootは要素を描画しないので、そのままではスロットの要素も含めどこにも付かない
// そこで自動で付けるのを止め、TooltipTriggerにv-bind="$attrs"で渡して、asChildでスロットの要素に付ける
defineOptions({
  inheritAttrs: false,
});

// のちのち統合する可能性があるため、BaseTooltipと共通のpropsは揃える
withDefaults(
  defineProps<{
    label: string;
    disabled?: boolean;
    open?: boolean;
    side?: "top" | "bottom";
    /** optimizedはスクロールやサイズの変化のときだけ位置を計算し直す。スライダーなど動く要素に付与する場合はalwaysにし、表示中は毎フレーム計算し直す */
    updatePositionStrategy?: "optimized" | "always";
  }>(),
  {
    disabled: false,
    open: undefined,
    side: "bottom",
    updatePositionStrategy: "optimized",
  },
);
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/song-variables" as song-vars;
@use "@/styles/v2/song-mixin" as song-mixin;

:deep(.song-tooltip) {
  @include song-mixin.popup-surface;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  height: song-vars.$size-control-small;
  padding: 0 song-vars.$space-8;
  box-shadow: song-vars.$shadow-popup;
  font-size: song-vars.$font-size-body;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  user-select: none;
  z-index: vars.$z-index-tooltip;
}
</style>
