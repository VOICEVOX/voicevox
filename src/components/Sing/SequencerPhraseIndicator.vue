<template>
  <div :class="[className, isInSelectedTrack && 'is-in-selected-track']"></div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";
import { getOrThrow } from "@/helpers/mapHelper";
import { PhraseKey, PhraseState } from "@/store/type";

const props = defineProps<{
  phraseKey: PhraseKey;
  isInSelectedTrack: boolean;
}>();

const store = useStore();
const classNames: Record<PhraseState, string> = {
  SINGER_IS_NOT_SET: "singer-is-not-set",
  WAITING_TO_BE_RENDERED: "waiting-to-be-rendered",
  NOW_RENDERING: "now-rendering",
  COULD_NOT_RENDER: "could-not-render",
  PLAYABLE: "playable",
};
const className = computed(() => {
  const phrase = getOrThrow(store.state.phrases, props.phraseKey);

  return classNames[phrase.state];
});
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

@function tint($color) {
  @return color-mix(in srgb, $color 50%, colors.$background);
}
@mixin tint-if-in-other-track($property, $color) {
  &.is-in-selected-track {
    #{$property}: $color;
  }
  &:not(.is-in-selected-track) {
    #{$property}: tint($color);
  }
}

.singer-is-not-set {
  visibility: hidden;
}

.waiting-to-be-rendered {
  background-color: color-mix(
    in oklch,
    var(--scheme-color-secondary-fixed-dim) 70%,
    var(--scheme-color-background)
  );
  @include tint-if-in-other-track(
    "background-color",
    color-mix(in srgb, colors.$primary 80%, colors.$background)
  );
}

.now-rendering {
  border: 1px solid --scheme-color-primary-fixed-dim;
  background-color: var(--scheme-color-background);
  background-size: 28px 28px;
  background-color: colors.$background;
  background-size: 28px 28px;
  animation: stripes-animation 0.7s linear infinite;
  &.is-in-selected-track {
    border: 1px solid rgba(colors.$primary-rgb, 0.7);
    background-image: linear-gradient(
      -45deg,
      colors.$primary,
      colors.$primary 25%,
      rgba(colors.$primary-rgb, 0.36) 25%,
      rgba(colors.$primary-rgb, 0.36) 50%,
      colors.$primary 50%,
      colors.$primary 75%,
      rgba(colors.$primary-rgb, 0.36) 75%,
      rgba(colors.$primary-rgb, 0.36) 100%
    );
  }
  &:not(.is-in-selected-track) {
    border: 1px solid tint(rgba(colors.$primary-rgb, 0.7));
    background-image: linear-gradient(
      -45deg,
      tint(colors.$primary),
      tint(colors.$primary) 25%,
      tint(rgba(colors.$primary-rgb, 0.36)) 25%,
      tint(rgba(colors.$primary-rgb, 0.36)) 50%,
      tint(colors.$primary) 50%,
      tint(colors.$primary) 75%,
      tint(rgba(colors.$primary-rgb, 0.36)) 75%,
      tint(rgba(colors.$primary-rgb, 0.36)) 100%
    );
  }
}

@keyframes stripes-animation {
  from {
    background-position-x: 0;
  }
  to {
    background-position-x: 28px;
  }
}

.could-not-render {
  background-color: var(--scheme-color-error);
  @include tint-if-in-other-track(
    "background-color",
    var(--scheme-color-error)
  );
}

.playable {
  visibility: hidden;
}
</style>
