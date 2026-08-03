<template>
  <CharacterSelectMenu :trackId="props.trackId">
    <template #trigger="{ disabled }">
      <button
        type="button"
        class="singer-trigger"
        :disabled
        :aria-label="singerSelectAriaLabel"
      >
        <div class="singer-selected-item">
          <div v-if="showSkeleton" class="singer-icon-skeleton" />
          <SingerIcon
            v-else-if="singerStyle"
            round
            size="36px"
            :style="singerStyle"
          />
          <div v-else class="unknown-singer">?</div>

          <div class="singer-info">
            <template v-if="showSkeleton">
              <div class="skeleton singer-name-skeleton" />
              <div class="skeleton singer-style-skeleton" />
            </template>
            <template v-else>
              <div class="singer-name">{{ singerName }}</div>
              <div class="singer-style">{{ styleDescription }}</div>
            </template>
          </div>
        </div>
      </button>
    </template>
  </CharacterSelectMenu>
</template>

<script setup lang="ts">
import { computed } from "vue";
import CharacterSelectMenu from "@/components/Sing/CharacterMenuButton/CharacterSelectMenu.vue";
import SingerIcon from "@/components/Sing/SingerIcon.vue";
import { getOrThrow } from "@/helpers/mapHelper";
import { getStyleDescription } from "@/sing/viewHelper";
import { useStore } from "@/store";
import type { TrackId } from "@/type/preload";

defineOptions({
  name: "SingerSelect",
});

const props = defineProps<{
  trackId: TrackId;
}>();

const store = useStore();
const track = computed(() => getOrThrow(store.state.tracks, props.trackId));
const singer = computed(() => track.value.singer);

const characterInfo = computed(() => {
  const currentSinger = singer.value;
  if (currentSinger == undefined) {
    return undefined;
  }
  return store.getters.CHARACTER_INFO(
    currentSinger.engineId,
    currentSinger.styleId,
  );
});

const showSkeleton = computed(
  () => singer.value != undefined && characterInfo.value == undefined,
);

const singerStyle = computed(() => {
  const currentSinger = singer.value;
  if (currentSinger == undefined) {
    return undefined;
  }
  return characterInfo.value?.metas.styles.find(
    (style) =>
      style.styleId === currentSinger.styleId &&
      style.engineId === currentSinger.engineId,
  );
});

const singerName = computed(
  () => characterInfo.value?.metas.speakerName ?? "未設定",
);

const styleDescription = computed(() => {
  const style = singerStyle.value;
  return style == undefined ? "" : getStyleDescription(style);
});

const singerSelectAriaLabel = computed(() =>
  `シンガーを選択：${singerName.value} ${styleDescription.value}`.trimEnd(),
);
</script>

<style scoped lang="scss">
.singer-trigger {
  appearance: none;
  width: 160px;
  height: 100%;
  min-width: 0;
  padding: 0 8px 0 4px;
  border: none;
  color: inherit;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--scheme-color-surface-container-high);
  }

  &:active:not(:disabled),
  &[data-state="open"] {
    background: var(--scheme-color-surface-container);
  }

  &:focus-visible {
    outline: 2px solid var(--scheme-color-primary);
    outline-offset: -2px;
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
}

.singer-selected-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  gap: 8px;
}

.singer-info {
  display: grid;
  grid-template-rows: 16px 12px;
  align-items: center;
  justify-items: start;
  width: 100%;
  min-width: 0;
  gap: 2px;
  text-align: left;
  overflow: hidden;
}

.singer-name {
  width: 100%;
  color: var(--scheme-color-on-surface);
  font-size: 13px;
  font-weight: bold;
  line-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.singer-style {
  width: 100%;
  color: var(--scheme-color-on-surface-variant);
  font-size: 10px;
  line-height: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unknown-singer,
.singer-icon-skeleton {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
}

.unknown-singer {
  display: grid;
  place-items: center;
  color: var(--scheme-color-on-primary);
  background: var(--scheme-color-primary);
}

.skeleton,
.singer-icon-skeleton {
  background: var(--scheme-color-surface-container-high);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.singer-name-skeleton {
  width: 64px;
  height: 13px;
}

.singer-style-skeleton {
  width: 48px;
  height: 9px;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 0.5;
  }

  50% {
    opacity: 1;
  }
}
</style>
