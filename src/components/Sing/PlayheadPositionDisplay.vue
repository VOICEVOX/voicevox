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
      <div class="sixteenths-fractional-part">
        .{{ sixteenthsFractionalPartStr }}
      </div>
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
import { getTimeSignaturePositions, tickToMbs } from "@/sing/domain";
import { MBS } from "@/store/type";

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

const mbs = computed((): MBS => {
  if (displayMode.value !== "MBS") {
    return { measures: 1, beats: 1, sixteenths: 1 };
  }
  const tpqn = store.state.tpqn;
  return tickToMbs(playheadTicks.value, timeSignatures.value, tpqn);
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

const sixteenthsFractionalPartStr = computed(() => {
  const integerPart = Math.floor(mbs.value.sixteenths);
  const fractionalPart = Math.floor((mbs.value.sixteenths - integerPart) * 100);
  return String(fractionalPart).padStart(2, "0");
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

.sixteenths-fractional-part {
  font-size: 16px;
  margin: 6px 0 0 2px;
}
</style>
