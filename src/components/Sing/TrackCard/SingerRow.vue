<template>
  <div class="singer-row">
    <QBtn flat noCaps class="zone singer-zone" :disable="uiLocked">
      <QSkeleton v-if="showSkeleton" type="QAvatar" size="36px" />
      <SingerIcon
        v-else-if="singerStyle"
        round
        size="36px"
        :style="singerStyle"
      />
      <QAvatar v-else round size="36px" color="primary">
        <span class="unknown-singer-mark">?</span>
      </QAvatar>
      <div class="singer-info">
        <template v-if="showSkeleton">
          <QSkeleton type="rect" width="64px" height="13px" />
          <QSkeleton type="rect" width="48px" height="9px" />
        </template>
        <template v-else>
          <div class="singer-name">{{ singerName }}</div>
          <div class="singer-style">{{ styleDescription }}</div>
        </template>
      </div>
      <CharacterSelectMenu :trackId="props.trackId" />
    </QBtn>
    <QSeparator vertical />
    <QBtn flat noCaps class="zone settings-zone" :disable="uiLocked">
      <div class="settings-summary">
        <div class="summary-line">
          歌い方
          <span class="summary-value teacher-value">{{
            singingTeacherName
          }}</span>
        </div>
        <div class="summary-line">
          声量
          <span class="summary-value adjustment-value">{{
            formatAdjustment(track.volumeRangeAdjustment)
          }}</span>
          音域
          <span class="summary-value adjustment-value">{{
            formatAdjustment(track.keyRangeAdjustment)
          }}</span>
        </div>
      </div>
      <QIcon name="arrow_drop_down" size="sm" class="dropdown-icon" />
      <SingingSettingsPopover :trackId="props.trackId" />
    </QBtn>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import CharacterSelectMenu from "@/components/Sing/CharacterMenuButton/CharacterSelectMenu.vue";
import SingerIcon from "@/components/Sing/SingerIcon.vue";
import SingingSettingsPopover from "@/components/Sing/SingingSettings/Popover.vue";
import { getOrThrow } from "@/helpers/mapHelper";
import { getStyleDescription } from "@/sing/viewHelper";
import { useStore } from "@/store";
import type { TrackId } from "@/type/preload";

defineOptions({
  name: "TrackCardSingerRow",
});

const props = defineProps<{
  trackId: TrackId;
}>();

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);
const track = computed(() => getOrThrow(store.state.tracks, props.trackId));

const singer = computed(() => track.value.singer);
const characterInfo = computed(() => {
  if (singer.value == undefined) {
    return undefined;
  }
  return store.getters.CHARACTER_INFO(
    singer.value.engineId,
    singer.value.styleId,
  );
});

// シンガー設定済みでキャラクター情報が未ロードの間だけスケルトンを表示する
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

const singingTeacherName = computed(() => {
  const currentSinger = singer.value;
  const singingTeacher = track.value.singingTeacher;
  if (currentSinger == undefined || singingTeacher == undefined) {
    return "未設定";
  }

  const teacherCharacterInfo = store.getters.CHARACTER_INFO(
    currentSinger.engineId,
    singingTeacher.styleId,
  );
  if (teacherCharacterInfo == undefined) {
    return "読み込み中";
  }

  const styleName = teacherCharacterInfo.metas.styles.find(
    (style) => style.styleId === singingTeacher.styleId,
  )?.styleName;
  return styleName == undefined
    ? teacherCharacterInfo.metas.speakerName
    : `${teacherCharacterInfo.metas.speakerName}（${styleName}）`;
});

const formatAdjustment = (value: number) => {
  return value > 0 ? `+${value}` : value.toString();
};
</script>

<style scoped lang="scss">
.singer-row {
  display: flex;
  align-items: stretch;
  height: 48px;
  border: 1px solid var(--scheme-color-outline-variant);
  border-radius: 8px;
  background: var(--scheme-color-surface-container-highest);
  overflow: hidden;

  &:hover {
    border-color: var(--scheme-color-outline);
  }
}

.zone {
  height: 100%;
  min-width: 0;
  padding: 0;
  border-radius: 0;

  :deep(.q-btn__content) {
    height: 100%;
    flex-wrap: nowrap;
  }
}

.singer-zone :deep(.q-btn__content) {
  gap: 8px;
  padding: 0 10px 0 6px;
}

.settings-zone :deep(.q-btn__content) {
  gap: 2px;
  padding: 0 4px 0 10px;
}

.unknown-singer-mark {
  color: var(--scheme-color-on-primary);
}

.singer-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
  min-width: 0;
}

.singer-name {
  max-width: 128px;
  color: var(--scheme-color-on-surface);
  font-size: 13px;
  font-weight: bold;
  line-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.singer-style {
  max-width: 128px;
  color: var(--scheme-color-on-surface-variant);
  font-size: 10px;
  line-height: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.settings-summary {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
}

.summary-line {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: var(--scheme-color-on-surface-variant);
  font-size: 9px;
  line-height: 14px;
  white-space: nowrap;
}

.summary-value {
  color: var(--scheme-color-on-surface);
  font-size: 11px;
  font-weight: bold;
}

.teacher-value {
  max-width: 112px;
  overflow: hidden;
  text-overflow: ellipsis;
}

// 値の増減で「音域」ラベルの位置が動かないように幅を確保する
.adjustment-value {
  min-width: 24px;
  text-align: left;
}

.dropdown-icon {
  color: var(--scheme-color-on-surface-variant);
  margin-right: 2px;
}
</style>
