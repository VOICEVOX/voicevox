<template>
  <div>
    <div v-if="displayMode === 'Seconds'" class="playhead-position">
      <div class="min-and-sec">{{ minAndSecStr }}</div>
      <div class="millisec">.{{ milliSecStr }}</div>
    </div>
    <div v-if="displayMode === 'MBS'" class="playhead-position">
      <div class="measures">{{ measuresStr }}.</div>
      <div class="beats">{{ beatsStr }}.</div>
      <div class="sixteenths-integer-part">{{ sixteenthsIntegerPartStr }}</div>
      <div class="sixteenths-decimal-part">.{{ sixteenthsDecimalPartStr }}</div>
    </div>
    <ContextMenu ref="contextMenu" :menudata="contextMenuData" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, Ref } from "vue";
import { useStore } from "@/store";
import ContextMenu, {
  ContextMenuItemData,
} from "@/components/Menu/ContextMenu.vue";
import {
  getBeatDuration,
  getMeasureDuration,
  getTimeSignaturePositions,
} from "@/sing/domain";
import { TimeSignature } from "@/store/type";

const store = useStore();

const playheadTicks = ref(0);
const displayMode: Ref<"Seconds" | "MBS"> = ref("MBS");

const timeSignatures = computed(() => {
  const tpqn = store.state.tpqn;
  const timeSignatures = store.state.timeSignatures;
  const tsPositions = getTimeSignaturePositions(timeSignatures, tpqn);
  return timeSignatures.map((value, index) => ({
    ...value,
    position: tsPositions[index],
  }));
});

const findTimeSignatureIndex = (
  ticks: number,
  timeSignatures: (TimeSignature & { position: number })[],
) => {
  if (ticks < 0) {
    return 0;
  }
  for (let i = 0; i < timeSignatures.length - 1; i++) {
    if (
      timeSignatures[i].position <= ticks &&
      timeSignatures[i + 1].position > ticks
    ) {
      return i;
    }
  }
  return timeSignatures.length - 1;
};

// Measures, Beats, Sixteenths
const mbs = computed(() => {
  if (displayMode.value !== "MBS") {
    return { measures: 1, beats: 1, sixteenths: 1, remaining: 0 };
  }
  const tpqn = store.state.tpqn;

  const ticks = playheadTicks.value;

  const tsIndex = findTimeSignatureIndex(ticks, timeSignatures.value);
  const ts = timeSignatures.value[tsIndex];

  const measureDuration = getMeasureDuration(ts.beats, ts.beatType, tpqn);
  const beatDuration = getBeatDuration(ts.beats, ts.beatType, tpqn);
  const sixteenthDuration = tpqn / 4;

  const posInTs = ticks - ts.position;
  const measuresInTs = Math.floor(posInTs / measureDuration);
  const measures = ts.measureNumber + measuresInTs;

  const posInMeasure = posInTs - measureDuration * measuresInTs;
  const beats = 1 + Math.floor(posInMeasure / beatDuration);

  const posInBeat = posInMeasure - beatDuration * (beats - 1);
  const sixteenths = 1 + posInBeat / sixteenthDuration;

  return { measures, beats, sixteenths };
});

const measuresStr = computed(() => {
  return mbs.value.measures >= 0
    ? String(mbs.value.measures).padStart(3, "0")
    : String(mbs.value.measures);
});

const beatsStr = computed(() => {
  return String(mbs.value.beats).padStart(2, "0");
});

const sixteenthsIntegerPartStr = computed(() => {
  const integerPart = Math.floor(mbs.value.sixteenths);
  return String(integerPart).padStart(2, "0");
});

const sixteenthsDecimalPartStr = computed(() => {
  const integerPart = Math.floor(mbs.value.sixteenths);
  const decimalPart = Math.floor((mbs.value.sixteenths - integerPart) * 100);
  return String(decimalPart).padStart(2, "0");
});

const minAndSecStr = computed(() => {
  if (displayMode.value !== "Seconds") {
    return "";
  }
  const ticks = playheadTicks.value;
  const time = store.getters.TICK_TO_SECOND(ticks);
  const intTime = Math.trunc(time);
  const min = Math.trunc(intTime / 60);
  const minStr = String(min).padStart(2, "0");
  const secStr = String(intTime - min * 60).padStart(2, "0");
  return `${minStr}:${secStr}`;
});

const milliSecStr = computed(() => {
  if (displayMode.value !== "Seconds") {
    return "";
  }
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
      label: "小節",
      disabled: displayMode.value === "MBS",
      onClick: async () => {
        contextMenu.value?.hide();
        displayMode.value = "MBS";
      },
      disableWhenUiLocked: false,
    },
    {
      type: "button",
      label: "秒",
      disabled: displayMode.value === "Seconds",
      onClick: async () => {
        contextMenu.value?.hide();
        displayMode.value = "Seconds";
      },
      disableWhenUiLocked: false,
    },
  ];
});

const playheadPositionChangeListener = (position: number) => {
  playheadTicks.value = position;
};

onMounted(() => {
  void store.dispatch("ADD_PLAYHEAD_POSITION_CHANGE_LISTENER", {
    listener: playheadPositionChangeListener,
  });
});

onUnmounted(() => {
  void store.dispatch("REMOVE_PLAYHEAD_POSITION_CHANGE_LISTENER", {
    listener: playheadPositionChangeListener,
  });
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/colors" as colors;

.playhead-position {
  align-items: center;
  display: flex;
  font-weight: 700;
  color: var(--scheme-color-on-surface);
}

.min-and-sec {
  font-size: 28px;
}

.millisec {
  font-size: 16px;
  margin: 10px 0 0 2px;
}

.measures {
  font-size: 24px;
}

.beats {
  font-size: 24px;
}

.sixteenths-integer-part {
  font-size: 24px;
}

.sixteenths-decimal-part {
  font-size: 16px;
  margin: 6px 0 0 2px;
}
</style>
