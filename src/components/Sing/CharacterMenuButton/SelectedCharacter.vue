<template>
  <div v-if="props.showSkeleton" class="selected-character">
    <QSkeleton class="character-avatar skeleton" type="QAvatar" size="36px" />
    <div class="character-info skeleton">
      <QSkeleton
        class="character-name skeleton"
        type="rect"
        width="64px"
        height="16px"
      />
      <QSkeleton
        class="character-style skeleton"
        type="rect"
        width="80px"
        height="8px"
      />
    </div>
  </div>
  <div v-else class="selected-character">
    <QAvatar v-if="selectedStyleIconPath" class="character-avatar">
      <img :src="selectedStyleIconPath" class="character-avatar-icon" />
    </QAvatar>
    <div class="character-info">
      <div class="character-name">
        {{ selectedCharacterName }}
      </div>
      <div class="character-style">
        {{ selectedCharacterStyleDescription }}
      </div>
    </div>
    <QIcon
      name="arrow_drop_down"
      size="sm"
      class="character-menu-dropdown-icon"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Singer } from "@/store/type";
import { CharacterInfo } from "@/type/preload";
import { getStyleDescription } from "@/sing/viewHelper";

const props = defineProps<{
  showSkeleton: boolean;
  selectedCharacterInfo: CharacterInfo | undefined;
  selectedSinger: Singer | undefined;
}>();

const selectedCharacterName = computed(() => {
  return props.selectedCharacterInfo?.metas.speakerName;
});
const selectedCharacterStyleDescription = computed(() => {
  const style = props.selectedCharacterInfo?.metas.styles.find((style) => {
    return (
      style.styleId === props.selectedSinger?.styleId &&
      style.engineId === props.selectedSinger?.engineId
    );
  });
  return style != undefined ? getStyleDescription(style) : "";
});
const selectedStyleIconPath = computed(() => {
  if (!props.selectedCharacterInfo || !props.selectedSinger) {
    return;
  }
  const styles = props.selectedCharacterInfo.metas.styles;
  return styles?.find((style) => {
    return (
      style.styleId === props.selectedSinger?.styleId &&
      style.engineId === props.selectedSinger?.engineId
    );
  })?.iconPath;
});
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;

.selected-character {
  border: 1px solid var(--scheme-color-outline-variant);
  border-radius: 4px 0 0 4px;
  align-items: center;
  display: flex;
  padding: 0 8px 0 4px;
  position: relative;
  height: 40px;
  font-smooth: antialiased;

  &:hover {
    border-color: var(--scheme-color-outline);
    background: oklch(from var(--scheme-color-secondary-container) l c h / 0.1);
  }

  &:focus {
    border-color: var(--scheme-color-primary);
  }

  .character-avatar {
    width: 36px;
    height: 36px;
  }

  .character-avatar-icon {
    border: 1px solid var(--scheme-color-outline-variant);
    display: block;
    height: 100%;
    object-fit: cover;
    width: 100%;
  }

  .character-info {
    align-items: start;
    display: flex;
    flex-direction: column;
    margin-left: 8px;
    text-align: left;
    justify-content: center;
    white-space: nowrap;
    font-optical-sizing: auto;
  }

  .character-name {
    color: var(--scheme-color-on-surface);
    font-size: 14px;
    font-weight: 400;
    line-height: 24px;
    padding-top: 12px;
    margin-bottom: 0;
    font-optical-sizing: auto;

    &.skeleton {
      margin-top: 0;
      margin-bottom: 0;
    }
  }

  .character-style {
    color: var(--scheme-color-on-surface-variant);
    font-size: 9px;
    font-weight: 400;
    line-height: 16px;
    margin-bottom: 8px;

    &.skeleton {
      transform: translateY(5px);
    }
    &:not(.skeleton) {
      transform: translateY(-5px);
    }
  }

  .character-menu-dropdown-icon {
    display: none;
    color: var(--scheme-color-on-surface-variant);
    margin-left: 4px;
  }
}
</style>
