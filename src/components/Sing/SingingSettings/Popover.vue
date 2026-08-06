<template>
  <QMenu
    class="singing-settings-popover"
    transitionShow="none"
    transitionHide="none"
  >
    <div class="settings">
      <QSelect
        class="teacher-select"
        :modelValue="singingTeacherStyleId"
        :options="singingTeacherOptions"
        label="歌い方"
        placeholder="未設定"
        outlined
        dense
        hideBottomSpace
        hideDropdownIcon
        optionsDense
        popupContentClass="teacher-select-menu"
        transitionShow="none"
        transitionHide="none"
        emitValue
        mapOptions
        :disable="uiLocked || singingTeacherOptions.length === 0"
        @update:modelValue="setSingingTeacher"
      >
        <template #selected-item="scope">
          <div class="teacher-selected-item">
            <SingerIcon round size="24px" :style="scope.opt.style" />
            <span class="teacher-selected-label">{{ scope.opt.label }}</span>
          </div>
        </template>
        <template #option="scope">
          <QItem v-bind="scope.itemProps" class="teacher-option">
            <QItemSection avatar class="teacher-option-avatar">
              <SingerIcon round size="24px" :style="scope.opt.style" />
            </QItemSection>
            <QItemSection>
              <QItemLabel class="teacher-option-label">
                {{ scope.opt.label }}
              </QItemLabel>
            </QItemSection>
          </QItem>
        </template>
      </QSelect>
      <QInput
        type="number"
        :modelValue="track.volumeRangeAdjustment"
        label="声量"
        outlined
        dense
        hideBottomSpace
        :min="MIN_VOLUME_RANGE_ADJUSTMENT"
        :max="MAX_VOLUME_RANGE_ADJUSTMENT"
        step="1"
        :disable="uiLocked"
        @change="setVolumeRangeAdjustment"
      />
      <QInput
        type="number"
        :modelValue="track.keyRangeAdjustment"
        label="音域"
        outlined
        dense
        hideBottomSpace
        :min="MIN_KEY_RANGE_ADJUSTMENT"
        :max="MAX_KEY_RANGE_ADJUSTMENT"
        step="1"
        :disable="uiLocked"
        @change="setKeyRangeAdjustment"
      />
    </div>
  </QMenu>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SingerIcon from "@/components/Sing/SingerIcon.vue";
import { getOrThrow } from "@/helpers/mapHelper";
import {
  isValidKeyRangeAdjustment,
  isValidVolumeRangeAdjustment,
  MAX_KEY_RANGE_ADJUSTMENT,
  MAX_VOLUME_RANGE_ADJUSTMENT,
  MIN_KEY_RANGE_ADJUSTMENT,
  MIN_VOLUME_RANGE_ADJUSTMENT,
} from "@/sing/domain";
import { useStore } from "@/store";
import {
  filterCharacterInfosByStyle,
  formatCharacterStyleName,
  isSingingTeacherStyle,
} from "@/store/utility";
import type { StyleId, StyleInfo, TrackId } from "@/type/preload";

defineOptions({
  name: "SingingSettingsPopover",
});

const props = defineProps<{
  trackId: TrackId;
}>();

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);
const track = computed(() => getOrThrow(store.state.tracks, props.trackId));

type SingingTeacherOption = {
  label: string;
  value: StyleId;
  style: StyleInfo;
};

const singingTeacherOptions = computed<SingingTeacherOption[]>(() => {
  const singer = track.value.singer;
  if (singer == undefined) {
    return [];
  }
  const characterInfos =
    store.getters.USER_ORDERED_CHARACTER_INFOS("all") ?? [];
  return filterCharacterInfosByStyle(
    characterInfos,
    (style) =>
      style.engineId === singer.engineId && isSingingTeacherStyle(style),
  ).flatMap((characterInfo) =>
    characterInfo.metas.styles.map((style) => ({
      label: formatCharacterStyleName(
        characterInfo.metas.speakerName,
        style.styleName,
      ),
      value: style.styleId,
      style,
    })),
  );
});

const singingTeacherStyleId = computed(() => {
  return track.value.singingTeacher?.styleId;
});

const setSingingTeacher = (styleId: StyleId) => {
  void store.actions.COMMAND_SET_SINGING_TEACHER({
    trackId: props.trackId,
    singingTeacher: { styleId },
  });
};

type AdjustmentInputValue = string | number | null;

const setKeyRangeAdjustment = (value: AdjustmentInputValue) => {
  if (value == undefined || value === "") {
    return;
  }
  const keyRangeAdjustment = Number(value);
  if (!isValidKeyRangeAdjustment(keyRangeAdjustment)) {
    return;
  }
  void store.actions.COMMAND_SET_KEY_RANGE_ADJUSTMENT({
    trackId: props.trackId,
    keyRangeAdjustment,
  });
};

const setVolumeRangeAdjustment = (value: AdjustmentInputValue) => {
  if (value == undefined || value === "") {
    return;
  }
  const volumeRangeAdjustment = Number(value);
  if (!isValidVolumeRangeAdjustment(volumeRangeAdjustment)) {
    return;
  }
  void store.actions.COMMAND_SET_VOLUME_RANGE_ADJUSTMENT({
    trackId: props.trackId,
    volumeRangeAdjustment,
  });
};
</script>

<style scoped lang="scss">
.settings {
  display: grid;
  width: 280px;
  gap: 12px;
  padding: 16px;
}

.teacher-selected-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  margin-top: 4px;
  gap: 8px;

  :deep(.q-avatar) {
    border-radius: 50%;
  }
}

.teacher-selected-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.teacher-option-avatar {
  min-width: 32px;
  padding-right: 8px;

  :deep(.q-avatar) {
    border-radius: 50%;
  }
}

.teacher-select {
  :deep(.q-field__control),
  :deep(.q-field__marginal) {
    height: 56px;
    min-height: 56px;
  }
}

.teacher-option {
  min-height: 40px;
  padding: 0 12px;
}

.teacher-option-label {
  line-height: 20px;
}

:global(.teacher-select-menu) {
  background: var(--scheme-color-surface-container);
}
</style>
