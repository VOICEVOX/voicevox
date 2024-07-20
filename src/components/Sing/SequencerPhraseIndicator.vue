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
  background-color: var(--md-sys-color-background);
  background-image: linear-gradient(
    to right,
    rgba(var(--md-sys-color-secondary-fixed-rgb), 0.8),
    rgba(var(--md-sys-color-secondary-fixed-rgb), 0.8)
  );
}

.now-rendering {
  border: 1px solid rgba(var(--md-sys-color-primary-fixed-dim-rgb), 0.7);
  background-color: var(--md-sys-color-background);
  background-size: 28px 28px;
  background-image: linear-gradient(
    -45deg,
    var(--md-sys-color-secondary-fixed),
    var(--md-sys-color-secondary-fixed) 25%,
    rgba(var(--md-sys-color-secondary-fixed-rgb), 0.36) 25%,
    rgba(var(--md-sys-color-secondary-fixed-rgb), 0.36) 50%,
    var(--md-sys-color-secondary-fixed) 50%,
    var(--md-sys-color-secondary-fixed) 75%,
    rgba(var(--md-sys-color-secondary-fixed-rgb), 0.36) 75%,
    rgba(var(--md-sys-color-secondary-fixed-rgb), 0.36) 100%
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
  background-color: var(--md-ref-palette-error-60);
}

.playable {
  visibility: hidden;
}
</style>
