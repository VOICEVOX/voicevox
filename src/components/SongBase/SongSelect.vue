<template>
  <SelectRoot v-model="model" v-model:open="open" :defaultValue :disabled>
    <SelectTrigger
      :aria-label="label"
      v-bind="$attrs"
      class="song-select-trigger"
    >
      <span v-if="label != undefined" class="label" aria-hidden="true">{{
        label
      }}</span>
      <SelectValue class="value" :placeholder />
      <SelectIcon asChild>
        <SongIcon name="keyboard_arrow_down" size="small" />
      </SelectIcon>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        class="song-select-content"
        position="popper"
        align="end"
        :sideOffset="4"
        :collisionPadding="8"
        avoidCollisions
        hideWhenDetached
      >
        <SelectViewport>
          <slot />
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script setup lang="ts" generic="T extends AcceptableValue">
import {
  SelectContent,
  SelectIcon,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
  type AcceptableValue,
} from "reka-ui";
import SongIcon from "./SongIcon.vue";

// ボタンに、親から渡したclassやイベントを付与するための設定
// Vueは渡された属性をコンポーネントのルートに付けるが、ルートのSelectRootは要素を描画しないので、そのままではどこにも付かない
// そこで自動で付けるのを止め、v-bind="$attrs"でSelectTriggerに付ける
defineOptions({
  inheritAttrs: false,
});

// のちのち統合する可能性があるため、BaseSelectと共通のpropsとv-modelは揃える
defineProps<{
  placeholder?: string;
  defaultValue?: T;
  disabled?: boolean;
  label?: string;
}>();

const model = defineModel<T>();
const open = defineModel<boolean>("open");
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/song-variables" as song-vars;
@use "@/styles/v2/song-mixin" as song-mixin;

.song-select-trigger {
  display: flex;
  align-items: center;
  gap: song-vars.$space-6;
  height: song-vars.$size-control-small;
  padding: 0 song-vars.$space-4 0 song-vars.$space-8;
  border: none;
  border-radius: song-vars.$radius-8;
  background-color: transparent;
  color: var(--scheme-color-song-on-surface-sub);
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  @include song-mixin.state-layer;
  @include song-mixin.focus-ring;
  @include song-mixin.disabled;
}

.label {
  font-size: song-vars.$font-size-caption;
}

.value {
  color: var(--scheme-color-on-surface);
  font-size: song-vars.$font-size-control;
  font-variant-numeric: tabular-nums;
}

:deep(.song-select-content) {
  @include song-mixin.popup-surface;
  min-width: max(120px, var(--reka-select-trigger-width));
  max-height: var(--reka-select-content-available-height);
  padding: song-vars.$space-4;
  border-radius: song-vars.$radius-12;
  box-shadow: song-vars.$shadow-popup;
  z-index: vars.$z-index-dropdown;
}
</style>
