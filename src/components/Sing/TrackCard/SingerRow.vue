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

  return teacherCharacterInfo.metas.speakerName;
});

const formatAdjustment = (value: number) => {
  return value > 0 ? `+${value}` : value.toString();
};
</script>

<style scoped lang="scss">
.singer-row {
  display: grid;
  grid-template-columns: 160px auto minmax(0, 1fr);
  flex: 1 0 280px;
  align-items: stretch;
  min-width: 280px;
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
  width: 100%;
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
  padding: 0 8px 0 4px;
}

.settings-zone :deep(.q-btn__content) {
  min-width: 0;
  gap: 2px;
  padding: 0 8px;
}

.unknown-singer-mark {
  color: var(--scheme-color-on-primary);
}

.singer-info,
.settings-summary {
  display: grid;
  grid-template-rows: 16px 12px;
  align-items: center;
  justify-items: start;
  gap: 2px;
}

.singer-info {
  width: 100%;
  min-width: 0;
  text-align: left;
  overflow: hidden;
}

.singer-name {
  width: 100%;
  max-width: 100%;
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
  max-width: 100%;
  color: var(--scheme-color-on-surface-variant);
  font-size: 10px;
  line-height: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.settings-summary {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.summary-line {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: baseline;
  gap: 4px;
  color: var(--scheme-color-on-surface-variant);
  font-size: 10px;
  white-space: nowrap;

  &:first-child {
    line-height: 16px;
  }

  &:last-child {
    line-height: 12px;
  }
}

.summary-value {
  color: var(--scheme-color-on-surface);
  font-size: 10px;
  font-weight: bold;
}

.teacher-value {
  flex: 1;
  min-width: 0;
  max-width: 112px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
}

// 値の増減で「音域」ラベルの位置が動かないように幅を確保する
.adjustment-value {
  min-width: 16px;
  text-align: left;
}
</style>
