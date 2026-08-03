<template>
  <BasePopover>
    <template #trigger="{ open }">
      <slot name="trigger" :open />
    </template>
    <div class="settings">
      <div class="teacher-field">
        <div class="teacher-label">歌い方</div>
        <div class="teacher-select">
          <BaseSelect
            :modelValue="singingTeacherStyleId"
            ariaLabel="歌い方"
            placeholder="未設定"
            hideIcon
            :disabled="uiLocked || singingTeacherOptions.length === 0"
            @update:modelValue="setSingingTeacher"
          >
            <template #value>
              <div
                v-if="selectedSingingTeacherOption"
                class="teacher-selected-item"
              >
                <SingerIcon
                  round
                  size="24px"
                  :style="selectedSingingTeacherOption.style"
                />
                <span class="teacher-selected-label">
                  {{ selectedSingingTeacherOption.label }}
                </span>
              </div>
              <span v-else class="teacher-selected-label">未設定</span>
            </template>
            <BaseSelectItem
              v-for="option in singingTeacherOptions"
              :key="option.value"
              class="teacher-option"
              :value="option.value"
              :label="option.label"
            >
              <div class="teacher-option-content">
                <SingerIcon round size="24px" :style="option.style" />
                <span class="teacher-option-label">{{ option.label }}</span>
              </div>
            </BaseSelectItem>
          </BaseSelect>
        </div>
      </div>
      <BaseNumberField
        :modelValue="track.volumeRangeAdjustment"
        label="声量"
        :min="MIN_VOLUME_RANGE_ADJUSTMENT"
        :max="MAX_VOLUME_RANGE_ADJUSTMENT"
        :step="1"
        :disabled="uiLocked"
        @update:modelValue="setVolumeRangeAdjustment"
      />
      <BaseNumberField
        :modelValue="track.keyRangeAdjustment"
        label="音域"
        :min="MIN_KEY_RANGE_ADJUSTMENT"
        :max="MAX_KEY_RANGE_ADJUSTMENT"
        :step="1"
        :disabled="uiLocked"
        @update:modelValue="setKeyRangeAdjustment"
      />
    </div>
  </BasePopover>
</template>

<script setup lang="ts">
import { computed } from "vue";
import BaseNumberField from "@/components/Base/BaseNumberField.vue";
import BasePopover from "@/components/Base/BasePopover.vue";
import BaseSelect from "@/components/Base/BaseSelect.vue";
import BaseSelectItem from "@/components/Base/BaseSelectItem.vue";
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

const selectedSingingTeacherOption = computed(() =>
  singingTeacherOptions.value.find(
    (option) => option.value === singingTeacherStyleId.value,
  ),
);

const setSingingTeacher = (styleId: StyleId | undefined) => {
  if (styleId == undefined) {
    return;
  }
  void store.actions.COMMAND_SET_SINGING_TEACHER({
    trackId: props.trackId,
    singingTeacher: { styleId },
  });
};

const setKeyRangeAdjustment = (keyRangeAdjustment: number) => {
  if (!isValidKeyRangeAdjustment(keyRangeAdjustment)) {
    return;
  }
  void store.actions.COMMAND_SET_KEY_RANGE_ADJUSTMENT({
    trackId: props.trackId,
    keyRangeAdjustment,
  });
};

const setVolumeRangeAdjustment = (volumeRangeAdjustment: number) => {
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
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;

.settings {
  display: grid;
  width: 280px;
  gap: 12px;
  padding: vars.$padding-2;
}

.teacher-selected-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  gap: vars.$gap-1;

  :deep(.q-avatar) {
    border-radius: 50%;
  }
}

.teacher-selected-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.teacher-field {
  display: grid;
  gap: 4px;
}

.teacher-label {
  color: colors.$display-sub;
  font-size: 12px;
  line-height: 12px;
}

.teacher-select {
  :deep(.SelectTrigger) {
    width: 100%;
    height: vars.$size-control;
    min-height: vars.$size-control;
    padding: 0 12px;
  }
}

.teacher-option {
  --base-select-item-min-height: #{vars.$size-listitem};
  --base-select-item-padding: 0 #{vars.$padding-2};
}

.teacher-option-content {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: vars.$gap-1;

  :deep(.q-avatar) {
    border-radius: 50%;
  }
}

.teacher-option-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 20px;
}
</style>
