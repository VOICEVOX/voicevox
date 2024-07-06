<template>
  <div v-if="props.showSkeleton" class="selected-character">
    <QSkeleton class="character-avatar" type="QAvatar" size="52px" />
    <div class="character-info">
      <QSkeleton
        class="character-name skeleton"
        type="rect"
        width="64px"
        height="16px"
      />
      <QSkeleton
        class="character-style"
        type="rect"
        width="110px"
        height="12px"
      />
    </div>
  </div>
  <div v-else class="selected-character">
    <QAvatar v-if="selectedStyleIconPath" class="character-avatar" size="3rem">
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
@use "@/styles/colors" as colors;

.selected-character {
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 4px 0 0 4px;
  align-items: center;
  display: flex;
  padding: 4px;
  position: relative;
  height: 56px;

  .character-avatar-icon {
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
  }

  .character-name {
    font-size: 15px;
    font-weight: 500;
    line-height: 24px;
    padding-top: 8px;
    margin-bottom: 0;

    &.skeleton {
      margin-top: 0;
      margin-bottom: 8px;
    }
  }

  .character-style {
    color: var(--md-sys-color-on-surface-variant);
    font-size: 10px;
    font-weight: 500;
    line-height: 16px;
    margin-bottom: 8px;
  }

  .character-menu-dropdown-icon {
    color: var(--md-sys-color-on-surface-variant);
    margin-left: 4px;
  }
}
</style>
