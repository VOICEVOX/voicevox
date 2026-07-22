<template>
  <QMenu
    class="singing-settings-popover"
    transitionShow="none"
    transitionHide="none"
  >
    <div class="settings">
      <QSelect
        :modelValue="undefined"
        :options="[]"
        displayValue="未設定"
        label="歌い方"
        outlined
        dense
        optionsDense
        disable
      />
      <QSelect
        :modelValue="track.keyRangeAdjustment"
        :options="keyRangeAdjustmentOptions"
        label="音域"
        outlined
        dense
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
import { getOrThrow } from "@/helpers/mapHelper";
import { useStore } from "@/store";
import type { TrackId } from "@/type/preload";

defineOptions({
  name: "SingingSettingsPopover",
});

const props = defineProps<{
  trackId: TrackId;
}>();

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);
const track = computed(() => getOrThrow(store.state.tracks, props.trackId));

const createAdjustmentOptions = (min: number, max: number, unit: string) => {
  return Array.from({ length: max - min + 1 }, (_, index) => {
    const value = min + index;
    const label = value > 0 ? `+${value}` : value.toString();
    return { label: `${label}${unit}`, value };
  });
};

const keyRangeAdjustmentOptions = createAdjustmentOptions(-28, 28, "");
const volumeRangeAdjustmentOptions = createAdjustmentOptions(-20, 20, " dB");

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
