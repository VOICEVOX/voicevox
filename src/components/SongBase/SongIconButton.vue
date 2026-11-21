<template>
  <SongTooltip :label>
    <button
      type="button"
      class="song-icon-button"
      :class="[variant, size]"
      :aria-label="label"
      :aria-pressed="pressed"
      :disabled
      @click="emit('click', $event)"
    >
      <SongIcon :name="icon" :size :filled />
    </button>
  </SongTooltip>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SongIcon from "./SongIcon.vue";
import SongTooltip from "./SongTooltip.vue";

// のちのち統合する可能性があるため、BaseIconButtonと共通のpropsとイベントは揃える
const props = withDefaults(
  defineProps<{
    icon: string;
    label: string;
    disabled?: boolean;
    pressed?: boolean;
    variant?: "default" | "primary";
    size?: "default" | "small";
  }>(),
  {
    disabled: false,
    // 省略したときにVueがfalseにしないよう、undefinedを既定値にする
    // falseだと、pressedが不要なボタンにもaria-pressedが付いてしまう
    pressed: undefined,
    variant: "default",
    size: "default",
  },
);

const emit = defineEmits<{
  (e: "click", payload: MouseEvent): void;
}>();

// アイコンの塗り分け
// ツールのように選択・未選択があるボタンは、選択中をfilled、未選択をoutlinedにする。それ以外はfilledにする
const filled = computed(() => props.pressed !== false);
</script>

<style scoped lang="scss">
@use "@/styles/v2/song-variables" as song-vars;
@use "@/styles/v2/song-mixin" as song-mixin;

.song-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: song-vars.$size-control;
  height: song-vars.$size-control;
  padding: 0;
  border: none;
  border-radius: song-vars.$radius-8;
  background-color: transparent;
  color: var(--scheme-color-song-on-surface-sub);
  cursor: pointer;
  @include song-mixin.state-layer;
  @include song-mixin.focus-ring;
  @include song-mixin.disabled;

  &.small {
    width: song-vars.$size-control-small;
    height: song-vars.$size-control-small;
    border-radius: song-vars.$radius-12;
  }

  &.default[aria-pressed="true"] {
    background-color: var(--scheme-color-song-control-selected);
    color: var(--scheme-color-on-surface);
  }

  &.primary[aria-pressed="true"] {
    background-color: var(--scheme-color-song-control-checked);
    color: var(--scheme-color-primary);
    @include song-mixin.state-layer(
      color-mix(in srgb, currentColor 8%, transparent),
      color-mix(in srgb, currentColor 12%, transparent)
    );
  }
}
</style>
