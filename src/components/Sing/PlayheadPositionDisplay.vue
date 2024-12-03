<template>
  <div>
    <div v-if="displayFormat === 'MINUTES_SECONDS'" class="playhead-position">
      <div>{{ minAndSecStr }}</div>
      <div class="millisec">.{{ milliSecStr }}</div>
    </div>
    <div v-if="displayFormat === 'MEASURES_BEATS'" class="playhead-position">
      <div>{{ measuresStr }}.</div>
      <div>{{ beatsIntegerPartStr }}</div>
      <div class="beats-fractional-part">.{{ beatsFractionalPartStr }}</div>
    </div>
    <ContextMenu ref="contextMenu" :menudata="contextMenuData" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useStore } from "@/store";
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu/Container.vue";
import {
  getTimeSignaturePositions,
  MeasuresBeats,
  ticksToMeasuresBeats,
} from "@/sing/domain";
import { useRootMiscSetting } from "@/composables/useRootMiscSetting";

const store = useStore();

const playheadTicks = computed(() => store.getters.PLAYHEAD_POSITION);
const [displayFormat, setDisplayFormat] = useRootMiscSetting(
  store,
  "playheadPositionDisplayFormat",
);

const timeSignatures = computed(() => {
  const tpqn = store.state.tpqn;
  const timeSignatures = store.state.timeSignatures;
  const tsPositions = getTimeSignaturePositions(timeSignatures, tpqn);
  return timeSignatures.map((value, index) => ({
    ...value,
    position: tsPositions[index],
  }));
});

const measuresBeats = computed((): MeasuresBeats => {
  const tpqn = store.state.tpqn;
  return ticksToMeasuresBeats(playheadTicks.value, timeSignatures.value, tpqn);
});

const measuresStr = computed(() => {
  return measuresBeats.value.measures >= 0
    ? String(measuresBeats.value.measures).padStart(3, "0")
    : String(measuresBeats.value.measures);
});

const beatsIntegerPartStr = computed(() => {
  const integerPart = Math.floor(measuresBeats.value.beats);
  return String(integerPart).padStart(2, "0");
});

const beatsFractionalPartStr = computed(() => {
  const integerPart = Math.floor(measuresBeats.value.beats);
  const fractionalPart = Math.floor(
    (measuresBeats.value.beats - integerPart) * 100,
  );
  return String(fractionalPart).padStart(2, "0");
});

const minAndSecStr = computed(() => {
  const ticks = playheadTicks.value;
  const time = store.getters.TICK_TO_SECOND(ticks);
  const intTime = Math.trunc(time);
  const min = Math.trunc(intTime / 60);
  const minStr = String(min).padStart(2, "0");
  const secStr = String(intTime - min * 60).padStart(2, "0");
  return `${minStr}:${secStr}`;
});

const milliSecStr = computed(() => {
  const ticks = playheadTicks.value;
  const time = store.getters.TICK_TO_SECOND(ticks);
  const intTime = Math.trunc(time);
  const milliSec = Math.trunc((time - intTime) * 1000);
  const milliSecStr = String(milliSec).padStart(3, "0");
  return milliSecStr;
});

const contextMenu = ref<InstanceType<typeof ContextMenu>>();
const contextMenuData = computed<ContextMenuItemData[]>(() => {
  return [
    {
      type: "button",
      label: "分:秒",
      disabled: displayFormat.value === "MINUTES_SECONDS",
      onClick: async () => {
        contextMenu.value?.hide();
        setDisplayFormat("MINUTES_SECONDS");
      },
      disableWhenUiLocked: false,
    },
    {
      type: "button",
      label: "小節.拍",
      disabled: displayFormat.value === "MEASURES_BEATS",
      onClick: async () => {
        contextMenu.value?.hide();
        setDisplayFormat("MEASURES_BEATS");
      },
      disableWhenUiLocked: false,
    },
  ];
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/colors" as colors;

.playhead-position {
  align-items: center;
  display: flex;
  font-weight: 700;
  font-size: 28px;
  color: var(--scheme-color-on-surface);
}

.millisec {
  font-size: 16px;
  margin: 10px 0 0 2px;
}

.beats-fractional-part {
  font-size: 16px;
  margin: 10px 0 0 2px;
}
</style>
