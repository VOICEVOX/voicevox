<template>
  <div class="character-card">
    <button
      class="character-detail-button"
      @click="$emit('selectCharacter', speakerUuid)"
    >
      <img
        :src="selectedStyle.iconPath"
        :alt="characterInfo.metas.speakerName"
        class="style-icon"
      />
      <div class="speaker-name">{{ characterInfo.metas.speakerName }}</div>
    </button>
    <hr class="line" />
    <div class="style-select-container">
      <BaseIconButton
        v-if="characterInfo.metas.styles.length > 1"
        icon="chevron_left"
        label="前のスタイル"
        @click.stop="rollStyleIndex(speakerUuid, -1)"
      />
      <div v-else></div>
      <BaseTooltip label="サンプルボイスを再生">
        <BaseButton
          :icon="
            playing != undefined &&
            speakerUuid === playing.speakerUuid &&
            selectedStyle.styleId === playing.styleId
              ? 'stop'
              : 'play_arrow'
          "
          :label="selectedStyle.styleName || DEFAULT_STYLE_NAME"
          @click.stop="togglePlayOrStop(speakerUuid, selectedStyle, 0)"
        />
      </BaseTooltip>
      <BaseIconButton
        v-if="characterInfo.metas.styles.length > 1"
        icon="chevron_right"
        label="次のスタイル"
        @click.stop="rollStyleIndex(speakerUuid, 1)"
      />
    </div>
    <div v-if="isNewCharacter" class="new-character-item">NEW!</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import BaseIconButton from "@/components/Base/BaseIconButton.vue";
import BaseButton from "@/components/Base/BaseButton.vue";
import BaseTooltip from "@/components/Base/BaseTooltip.vue";
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
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: vars.$gap-1;
  padding: vars.$padding-1;
  border: 1px solid colors.$border;
  background-color: colors.$surface;
  border-radius: vars.$radius-2;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.character-detail-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: vars.$gap-1;
  cursor: pointer;
  width: 100%;
  border-radius: vars.$radius-1;
  border: none;
  background-color: transparent;

  &:hover {
    background-color: colors.$clear-hovered;
  }

  &:active {
    background-color: colors.$control-pressed;
    box-shadow: 0 0 0 transparent;
  }

  &:focus-visible {
    @include mixin.on-focus;
  }
}

.style-icon {
  height: 128px;
  aspect-ratio: 1 / 1;
  border-radius: vars.$radius-1;
}

.speaker-name {
  font-size: 1.125rem;
  font-weight: 600;
  text-align: center;
  line-height: 1;
}

.line {
  height: 1px;
  width: 100%;
  background-color: colors.$border;
  border: none;
  margin: 0;
}

.style-select-container {
  display: grid;
  grid-template-columns: vars.$size-control 1fr vars.$size-control;
  align-items: center;
  width: 100%;
  margin: auto;
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
