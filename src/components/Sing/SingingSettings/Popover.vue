<template>
  <QMenu
    class="singing-settings-popover"
    transitionShow="none"
    transitionHide="none"
  >
    <div class="settings">
      <QSelect
        :modelValue="singingTeacherKey"
        :options="singingTeacherOptions"
        label="歌い方"
        placeholder="未設定"
        outlined
        dense
        hideBottomSpace
        optionsDense
        emitValue
        mapOptions
        :disable="uiLocked || singingTeacherOptions.length === 0"
        @update:modelValue="setSingingTeacher"
      />
      <QSelect
        :modelValue="track.keyRangeAdjustment"
        :options="keyRangeAdjustmentOptions"
        label="音域"
        outlined
        dense
        hideBottomSpace
        optionsDense
        emitValue
        mapOptions
        :disable="uiLocked"
        @update:modelValue="setKeyRangeAdjustment"
      />
      <QSelect
        :modelValue="track.volumeRangeAdjustment"
        :options="volumeRangeAdjustmentOptions"
        label="声量"
        outlined
        dense
        hideBottomSpace
        optionsDense
        emitValue
        mapOptions
        :disable="uiLocked"
        @update:modelValue="setVolumeRangeAdjustment"
      />
    </div>
  </QMenu>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { SingingTeacher } from "@/domain/project/type";
import { getOrThrow } from "@/helpers/mapHelper";
import { useStore } from "@/store";
import {
  filterCharacterInfosByStyle,
  isSingingTeacherStyle,
} from "@/store/utility";
import type { StyleInfo, TrackId } from "@/type/preload";

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
  value: string;
  singingTeacher: SingingTeacher;
};

const getSingingTeacherKey = (singingTeacher: SingingTeacher) => {
  return `${singingTeacher.engineId}:${singingTeacher.styleId}`;
};

const getSingingTeacherLabel = (speakerName: string, style: StyleInfo) => {
  return style.styleName == undefined
    ? speakerName
    : `${speakerName}（${style.styleName}）`;
};

const singingTeacherOptions = computed<SingingTeacherOption[]>(() => {
  const characterInfos =
    store.getters.USER_ORDERED_CHARACTER_INFOS("all") ?? [];
  return filterCharacterInfosByStyle(
    characterInfos,
    isSingingTeacherStyle,
  ).flatMap((characterInfo) =>
    characterInfo.metas.styles.map((style) => {
      const singingTeacher = {
        engineId: style.engineId,
        styleId: style.styleId,
      };
      return {
        label: getSingingTeacherLabel(characterInfo.metas.speakerName, style),
        value: getSingingTeacherKey(singingTeacher),
        singingTeacher,
      };
    }),
  );
});

const singingTeacherOptionsByKey = computed(() => {
  return new Map(
    singingTeacherOptions.value.map((option) => [option.value, option]),
  );
});

const singingTeacherKey = computed(() => {
  const singingTeacher = track.value.singingTeacher;
  return singingTeacher == undefined
    ? undefined
    : getSingingTeacherKey(singingTeacher);
});

const createAdjustmentOptions = (min: number, max: number, unit: string) => {
  return Array.from({ length: max - min + 1 }, (_, index) => {
    const value = min + index;
    const label = value > 0 ? `+${value}` : value.toString();
    return { label: `${label}${unit}`, value };
  });
};

const keyRangeAdjustmentOptions = createAdjustmentOptions(-28, 28, "");
const volumeRangeAdjustmentOptions = createAdjustmentOptions(-20, 20, " dB");

const setSingingTeacher = (key: string) => {
  const { singingTeacher } = getOrThrow(singingTeacherOptionsByKey.value, key);
  void store.actions.COMMAND_SET_SINGING_TEACHER({
    trackId: props.trackId,
    singingTeacher,
  });
};

const setKeyRangeAdjustment = (keyRangeAdjustment: number) => {
  void store.actions.COMMAND_SET_KEY_RANGE_ADJUSTMENT({
    trackId: props.trackId,
    keyRangeAdjustment,
  });
};

const setVolumeRangeAdjustment = (volumeRangeAdjustment: number) => {
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
</style>
