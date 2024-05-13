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
  background-color: colors.$background;
  background-image: linear-gradient(
    to right,
    rgba(colors.$primary-rgb, 0.8),
    rgba(colors.$primary-rgb, 0.8)
  );
}

.now-rendering {
  border: 1px solid rgba(colors.$primary-rgb, 0.7);
  background-color: colors.$background;
  background-size: 28px 28px;
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
  background-color: colors.$warning;
}

.playable {
  visibility: hidden;
}
</style>
