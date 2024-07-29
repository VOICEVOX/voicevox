<template>
  <div :class="`${className}`"></div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";
import { getOrThrow } from "@/helpers/mapHelper";
import { PhraseSourceHash, PhraseState } from "@/store/type";

const props = defineProps<{
  phraseKey: PhraseSourceHash;
}>();

const store = useStore();
const classNames: Record<PhraseState, string> = {
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

.waiting-to-be-rendered {
  background-color: var(--scheme-color-background);
  background-image: linear-gradient(
    to right,
    --scheme-color-secondary-container,
    --scheme-color-secondary-container
  );
}

.now-rendering {
  border: 1px solid --scheme-color-secondary-container;
  background-color: var(--scheme-color-surface);
  background-size: 28px 28px;
  background-image: linear-gradient(
    -45deg,
    var(--scheme-color-secondary-container) 25%,
    color-mix(
        in oklch,
        var(--scheme-color-secondary-container) 36%,
        var(--scheme-color-surface)
      )
      25%,
    color-mix(
        in oklch,
        var(--scheme-color-secondary-container) 36%,
        var(--scheme-color-surface)
      )
      50%,
    var(--scheme-color-secondary-container) 50%,
    var(--scheme-color-secondary-container) 75%,
    color-mix(
        in oklch,
        var(--scheme-color-secondary-container) 36%,
        var(--scheme-color-surface)
      )
      75%,
    color-mix(
        in oklch,
        var(--scheme-color-secondary-container) 36%,
        var(--scheme-color-surface)
      )
      100%
  );
  animation: stripes-animation 0.7s linear infinite;
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
}

.playable {
  visibility: hidden;
}
</style>
