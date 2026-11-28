<template>
  <div class="edit-toolbar">
    <div class="start">
      <slot name="start" />
    </div>
    <div class="center">
      <slot name="center" />
    </div>
    <div class="end">
      <slot name="end" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { SEQUENCER_KEYS_WIDTH } from "@/song/viewHelper";
</script>

<style scoped lang="scss">
@use "@/styles/v2/song-variables" as song-vars;

.edit-toolbar {
  $border-width: 1px;

  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  column-gap: song-vars.$space-8;
  height: calc(
    song-vars.$size-control-small + song-vars.$space-4 * 2 + $border-width
  );
  padding: song-vars.$space-4 song-vars.$space-12;
  border-bottom: $border-width solid var(--scheme-color-song-divider);
  background-color: var(--scheme-color-surface-container-highest);
}

.start,
.center,
.end {
  display: flex;
  align-items: center;
}

.start {
  justify-self: start;
  padding-left: calc(
    v-bind("`${SEQUENCER_KEYS_WIDTH}px`") + #{song-vars.$space-8} -
      #{song-vars.$space-12}
  );
}

.center {
  gap: song-vars.$space-2;
}

.end {
  justify-self: end;
}
</style>
