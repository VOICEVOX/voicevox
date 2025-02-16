<template>
  <button class="character-card" @click="$emit('selectCharacter', speakerUuid)">
    <img
      :src="selectedStyle.iconPath"
      :alt="characterInfo.metas.speakerName"
      class="style-icon"
    />
    <div class="speaker-name">{{ characterInfo.metas.speakerName }}</div>
    <div class="style-select-container">
      <BaseIconButton
        v-if="characterInfo.metas.styles.length > 1"
        icon="chevron_left"
        label="前のスタイル"
        @click.stop="rollStyleIndex(speakerUuid, -1)"
      />
      <span aria-live="polite">{{
        selectedStyle.styleName || DEFAULT_STYLE_NAME
      }}</span>
      <BaseIconButton
        v-if="characterInfo.metas.styles.length > 1"
        icon="chevron_right"
        label="次のスタイル"
        @click.stop="rollStyleIndex(speakerUuid, 1)"
      />
    </div>
    <div class="voice-samples">
      <BaseIconButton
        v-for="voiceSampleIndex of [...Array(3).keys()]"
        :key="voiceSampleIndex"
        :icon="
          playing != undefined &&
          speakerUuid === playing.speakerUuid &&
          selectedStyle.styleId === playing.styleId &&
          voiceSampleIndex === playing.index
            ? 'stop'
            : 'play_arrow'
        "
        :label="`サンプルボイス${voiceSampleIndex + 1}`"
        @click.stop="
          togglePlayOrStop(speakerUuid, selectedStyle, voiceSampleIndex)
        "
      />
    </div>
    <div v-if="isNewCharacter" class="new-character-item">NEW!</div>
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import BaseIconButton from "@/components/Base/BaseIconButton.vue";
import { CharacterInfo, SpeakerId, StyleId, StyleInfo } from "@/type/preload";
import { DEFAULT_STYLE_NAME } from "@/store/utility";

const props = defineProps<{
  characterInfo: CharacterInfo;
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

defineEmits<{
  (event: "selectCharacter", speakerUuid: SpeakerId): void;
}>();

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
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;

.character-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid colors.$border;
  background-color: colors.$surface;
  color: colors.$display;
  border-radius: vars.$radius-2;
  padding: vars.$padding-1;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  position: relative;

  &:hover {
    background-color: colors.$control-hovered;
  }

  &:active {
    background-color: colors.$control-pressed;
    box-shadow: 0 0 0 transparent;
  }

  &:focus-visible {
    @include mixin.on-focus;
  }

  &:disabled {
    opacity: 0.5;
  }
}

.style-icon {
  width: 100%;
  max-width: 128px;
  height: auto;
  aspect-ratio: 1 / 1;
  border-radius: vars.$radius-2;
  margin-bottom: vars.$gap-1;
}

.speaker-name {
  font-size: 1.125rem;
  font-weight: 600;
  text-align: center;
}

.style-select-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: vars.$size-control;
}

.voice-samples {
  display: flex;
}

.new-character-item {
  position: absolute;
  left: vars.$padding-1;
  top: vars.$padding-1;
  border-radius: vars.$radius-1;
  background-color: colors.$primary;
  color: colors.$display-oncolor;
  padding: vars.$padding-1;
  line-height: 1;
  font-weight: bold;
}
</style>
