<template>
  <QItem
    v-ripple="isHoverableItem"
    clickable
    class="q-pa-none character-item"
    :class="[
      isHoverableItem && 'hoverable-character-item',
      isSelected && 'selected-character-item',
    ]"
    @click="
      selectCharacter(speakerUuid);
      togglePlayOrStop(speakerUuid, selectedStyle, 0);
    "
  >
    <div class="character-item-inner">
      <img
        :src="characterInfo.metas.styles[selectedStyleIndex || 0].iconPath"
        :alt="characterInfo.metas.speakerName"
        class="style-icon"
      />
      <span class="text-subtitle1 q-ma-sm">{{
        characterInfo.metas.speakerName
      }}</span>
      <div
        v-if="characterInfo.metas.styles.length > 1"
        class="style-select-container"
      >
        <QBtn
          flat
          dense
          icon="chevron_left"
          textColor="display"
          class="style-select-button"
          aria-label="前のスタイル"
          @mouseenter="isHoverableItem = false"
          @mouseleave="isHoverableItem = true"
          @click.stop="
            selectCharacter(speakerUuid);
            rollStyleIndex(speakerUuid, -1);
          "
        />
        <span aria-live="polite">{{
          selectedStyle.styleName || DEFAULT_STYLE_NAME
        }}</span>
        <QBtn
          flat
          dense
          icon="chevron_right"
          textColor="display"
          class="style-select-button"
          aria-label="次のスタイル"
          @mouseenter="isHoverableItem = false"
          @mouseleave="isHoverableItem = true"
          @click.stop="
            selectCharacter(speakerUuid);
            rollStyleIndex(speakerUuid, 1);
          "
        />
      </div>
      <div class="voice-samples">
        <QBtn
          v-for="voiceSampleIndex of [...Array(3).keys()]"
          :key="voiceSampleIndex"
          round
          outline
          :icon="
            playing != undefined &&
            speakerUuid === playing.speakerUuid &&
            selectedStyle.styleId === playing.styleId &&
            voiceSampleIndex === playing.index
              ? 'stop'
              : 'play_arrow'
          "
          color="primary"
          class="voice-sample-btn"
          :aria-label="`サンプルボイス${voiceSampleIndex + 1}`"
          @mouseenter="isHoverableItem = false"
          @mouseleave="isHoverableItem = true"
          @click.stop="
            selectCharacter(speakerUuid);
            togglePlayOrStop(speakerUuid, selectedStyle, voiceSampleIndex);
          "
        />
      </div>
      <div
        v-if="isNewCharacter"
        class="new-character-item q-pa-sm text-weight-bold"
      >
        NEW!
      </div>
    </div>
  </QItem>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { CharacterInfo, SpeakerId, StyleId, StyleInfo } from "@/type/preload";
import { DEFAULT_STYLE_NAME } from "@/store/utility";

const props = defineProps<{
  characterInfo: CharacterInfo;
  isSelected: boolean;
  isNewCharacter?: boolean;
  playing?: {
    speakerUuid: SpeakerId;
    styleId: StyleId;
    index: number;
  };
  togglePlayOrStop: (
    speakerUuid: SpeakerId,
    styleInfo: StyleInfo,
    index: number,
  ) => void;
}>();

const emit = defineEmits<{
  (event: "update:selectCharacter", speakerUuid: SpeakerId): void;
  (event: "update:portrait", portrait: string): void;
}>();

// キャラクター枠のホバー状態を表示するかどうか
// 再生ボタンなどにカーソルがある場合はキャラクター枠のホバーUIを表示しないようにするため
const isHoverableItem = ref(true);

const selectCharacter = (speakerUuid: SpeakerId) => {
  emit("update:selectCharacter", speakerUuid);
  updatePortrait();
};

const updatePortrait = () => {
  let portraitPath = props.characterInfo.portraitPath;
  const stylePortraitPath = selectedStyle.value.portraitPath;
  if (stylePortraitPath) {
    portraitPath = stylePortraitPath;
  }
  emit("update:portrait", portraitPath);
};

const speakerUuid = computed(() => props.characterInfo.metas.speakerUuid);

// 選択中のスタイル
const selectedStyleIndex = ref<number>(0);
const selectedStyle = computed(
  () => props.characterInfo.metas.styles[selectedStyleIndex.value],
);

// スタイル番号をずらす
const rollStyleIndex = (speakerUuid: SpeakerId, diff: number) => {
  // 0 <= index <= length に収める
  const length = props.characterInfo.metas.styles.length;

  let styleIndex = selectedStyleIndex.value + diff;
  styleIndex = styleIndex < 0 ? length - 1 : styleIndex % length;
  selectedStyleIndex.value = styleIndex;

  // 音声を再生する。同じstyleIndexだったら停止する。
  props.togglePlayOrStop(speakerUuid, selectedStyle.value, 0);
  updatePortrait();
};
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.character-item {
  box-shadow: 0 0 0 1px rgba(colors.$primary-rgb, 0.5);
  border-radius: 10px;
  overflow: hidden;
  &.selected-character-item {
    box-shadow: 0 0 0 2px colors.$primary;
  }
  &:hover :deep(.q-focus-helper) {
    opacity: 0 !important;
  }
  &.hoverable-character-item:hover :deep(.q-focus-helper) {
    opacity: 0.15 !important;
  }
  .character-item-inner {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    .style-icon {
      $icon-size: calc(vars.$character-item-size / 2);
      width: $icon-size;
      height: $icon-size;
      border-radius: 5px;
    }
    .style-select-container {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      margin-top: -1rem;
    }
    .voice-samples {
      display: flex;
      column-gap: 5px;
      align-items: center;
      justify-content: center;
    }
    .new-character-item {
      color: colors.$primary;
      position: absolute;
      left: 0px;
      top: 0px;
    }
  }
}
</style>
