<template>
  <QBtn flat noCaps class="singing-settings-button" :disable="uiLocked">
    <div class="setting-summary teacher-summary">
      <span class="setting-label">歌い方</span>
      <span class="setting-value">{{ singingTeacherName }}</span>
    </div>
    <QSeparator vertical />
    <div class="setting-summary">
      <span class="setting-label">音域</span>
      <span class="setting-value">
        {{ formatAdjustment(track.keyRangeAdjustment) }}
      </span>
    </div>
    <QSeparator vertical />
    <div class="setting-summary">
      <span class="setting-label">声量</span>
      <span class="setting-value">
        {{ formatAdjustment(track.volumeRangeAdjustment) }} dB
      </span>
    </div>
    <QIcon name="arrow_drop_down" size="sm" class="dropdown-icon" />
    <SingingSettingsPopover :trackId />
  </QBtn>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SingingSettingsPopover from "./Popover.vue";
import { getOrThrow } from "@/helpers/mapHelper";
import { useStore } from "@/store";
import type { TrackId } from "@/type/preload";

defineOptions({
  name: "SingingSettingsButton",
});

const props = defineProps<{
  trackId: TrackId;
}>();

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);
const track = computed(() => getOrThrow(store.state.tracks, props.trackId));

const singingTeacherName = computed(() => {
  const singingTeacher = track.value.singingTeacher;
  if (singingTeacher == undefined) {
    return "未設定";
  }

  const characterInfo = store.getters.CHARACTER_INFO(
    singingTeacher.engineId,
    singingTeacher.styleId,
  );
  if (characterInfo == undefined) {
    return "読み込み中";
  }

  const styleName = characterInfo.metas.styles.find(
    (style) =>
      style.engineId === singingTeacher.engineId &&
      style.styleId === singingTeacher.styleId,
  )?.styleName;
  return styleName == undefined
    ? characterInfo.metas.speakerName
    : `${characterInfo.metas.speakerName}（${styleName}）`;
});

const formatAdjustment = (value: number) => {
  return value > 0 ? `+${value}` : value.toString();
};
</script>

<style scoped lang="scss">
.singing-settings-button {
  height: 40px;
  min-width: 0;
  padding: 0;
  border: 1px solid var(--scheme-color-outline-variant);
  border-left: 0;
  border-radius: 0 4px 4px 0;

  &:hover {
    border-color: var(--scheme-color-outline);
    background: oklch(from var(--scheme-color-secondary-container) l c h / 0.1);
  }

  :deep(.q-btn__content) {
    height: 100%;
  }
}

.setting-summary {
  display: flex;
  min-width: 56px;
  height: 100%;
  padding: 4px 8px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  white-space: nowrap;
}

.setting-label {
  color: var(--scheme-color-on-surface-variant);
  font-size: 9px;
  line-height: 12px;
}

.setting-value {
  color: var(--scheme-color-on-surface);
  font-size: 12px;
  line-height: 16px;
}

.teacher-summary .setting-value {
  max-width: 112px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-icon {
  color: var(--scheme-color-on-surface-variant);
  margin: 0 4px 0 2px;
}
</style>
