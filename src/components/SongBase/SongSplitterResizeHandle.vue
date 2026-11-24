<template>
  <SplitterResizeHandle
    class="song-splitter-resize-handle"
    :class="hitArea"
    :hitAreaMargins
    :disabled
    @dragging="onDragging"
    @keyup="onKeyup"
  />
</template>

<script setup lang="ts">
import { inject } from "vue";
import { SplitterResizeHandle } from "reka-ui";
import { songSplitterGroupInjectionKey } from "./SongSplitterGroup.vue";

withDefaults(
  defineProps<{
    disabled?: boolean;
    /** 当たり判定を片側に限るときに指定する。startは前のパネル側、endは次のパネル側 */
    hitArea?: "both" | "start" | "end";
  }>(),
  {
    disabled: false,
    hitArea: "both",
  },
);

const group = inject(songSplitterGroupInjectionKey);
if (group == undefined) {
  throw new Error(
    "SongSplitterResizeHandle must be used within SongSplitterGroup",
  );
}

const onDragging = (isDragging: boolean) => {
  if (!isDragging) {
    group.commit();
  }
};

// キー操作ではdraggingが出ないので、キーを離したときに確定させる
const RESIZE_KEYS = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
];
const onKeyup = (event: KeyboardEvent) => {
  if (RESIZE_KEYS.includes(event.key)) {
    group.commit();
  }
};

// rekaのhitAreaMarginsでの当たり判定は、スクロールバーなど操作できない領域にかぶった場合でも反応してしまうので使わない
const hitAreaMargins = { coarse: 0, fine: 0 };
</script>

<style scoped lang="scss">
@use "@/styles/v2/song-variables" as song-vars;
@use "@/styles/v2/song-mixin" as song-mixin;

.song-splitter-resize-handle {
  $line: 1px;

  --hit-area-start: #{song-vars.$space-4};
  --hit-area-end: #{song-vars.$space-4};

  position: relative;
  z-index: 1;
  @include song-mixin.focus-ring;

  &.start {
    --hit-area-end: 0px;
  }

  &.end {
    --hit-area-start: 0px;
  }

  &[data-orientation="vertical"] {
    height: calc(var(--hit-area-start) + #{$line} + var(--hit-area-end));
    margin-top: calc(-1 * var(--hit-area-start));
    margin-bottom: calc(-1 * var(--hit-area-end));

    &::before {
      inset: var(--hit-area-start) 0 auto;
      height: $line;
    }
  }

  &[data-orientation="horizontal"] {
    width: calc(var(--hit-area-start) + #{$line} + var(--hit-area-end));
    margin-left: calc(-1 * var(--hit-area-start));
    margin-right: calc(-1 * var(--hit-area-end));

    &::before {
      inset: 0 auto 0 var(--hit-area-start);
      width: $line;
    }
  }

  &::before {
    content: "";
    position: absolute;
    background-color: var(--scheme-color-song-divider);
  }

  &[data-state="hover"]::before,
  &[data-state="drag"]::before {
    background-color: var(--scheme-color-primary);
  }
}
</style>
