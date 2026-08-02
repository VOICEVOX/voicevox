<template>
  <div class="singer-row">
    <SingerSelect :trackId="props.trackId" />
    <div class="divider" />
    <SingingSettingsPopover :trackId="props.trackId">
      <template #trigger>
        <button class="zone settings-zone" type="button" :disabled="uiLocked">
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
        </button>
      </template>
    </SingingSettingsPopover>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SingingSettingsPopover from "@/components/Sing/SingingSettings/Popover.vue";
import SingerSelect from "@/components/Sing/TrackCard/SingerSelect.vue";
import { getOrThrow } from "@/helpers/mapHelper";
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

const singingTeacherName = computed(() => {
  const currentSinger = track.value.singer;
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
  grid-template-columns: 160px 1px minmax(0, 1fr);
  flex: 1 0 280px;
  align-items: stretch;
  min-width: 280px;
  height: 48px;
  border: 1px solid var(--scheme-color-outline-variant);
  border-radius: 8px;
  background: var(--scheme-color-surface-container-highest);
  overflow: hidden;
}

.zone {
  appearance: none;
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 0;
  border: none;
  border-radius: 0;
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

.settings-zone {
  padding: 0 8px;
}

.divider {
  background: var(--scheme-color-outline-variant);
}

.settings-summary {
  display: grid;
  grid-template-rows: 16px 12px;
  align-items: center;
  justify-items: start;
  width: 100%;
  min-width: 0;
  gap: 2px;
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
  flex: 0 0 20px;
  width: 20px;
  text-align: left;
}
</style>
