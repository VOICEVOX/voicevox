import { computed } from "vue";
import { useStore } from "@/store";
import { tickToSecond, getNoteDuration } from "@/sing/domain";
import { baseXToTick } from "@/sing/viewHelper";

export function useLoopControl() {
  const store = useStore();

  const isLoopEnabled = computed(() => store.state.isLoopEnabled);
  const loopStartTick = computed(() => store.state.loopStartTick);
  const loopEndTick = computed(() => store.state.loopEndTick);

  const loopStartTime = computed(() => {
    if (loopStartTick.value == null) return null;
    return tickToSecond(
      loopStartTick.value,
      store.state.tempos,
      store.state.tpqn,
    );
  });

  const loopEndTime = computed(() => {
    if (loopEndTick.value == null) return null;
    return tickToSecond(
      loopEndTick.value,
      store.state.tempos,
      store.state.tpqn,
    );
  });

  const setLoopEnabled = async (value: boolean): Promise<void> => {
    try {
      await store.dispatch("COMMAND_SET_LOOP_ENABLED", {
        isLoopEnabled: value,
      });
    } catch (error) {
      throw new Error("Failed to set loop enabled state", { cause: error });
    }
  };

  const setLoopRange = async (
    startTick: number,
    endTick: number,
  ): Promise<void> => {
    try {
      await store.dispatch("COMMAND_SET_LOOP_RANGE", {
        loopStartTick: startTick,
        loopEndTick: endTick,
      });
    } catch (error) {
      throw new Error("Failed to set loop range", { cause: error });
    }
  };

  const clearLoopRange = async (): Promise<void> => {
    try {
      await store.dispatch("COMMAND_CLEAR_LOOP_RANGE");
    } catch (error) {
      throw new Error("Failed to clear loop range", { cause: error });
    }
  };

  const snapToGrid = (tick: number): number => {
    const sequencerSnapType = store.state.sequencerSnapType;
    const snapInterval = getNoteDuration(sequencerSnapType, store.state.tpqn);
    return Math.round(tick / snapInterval) * snapInterval;
  };

  const addOneMeasureLoop = (
    x: number,
    offset: number,
    tpqn: number,
    zoomX: number,
  ) => {
    const timeSignature = store.state.timeSignatures[0];
    const oneMeasureTicks =
      getNoteDuration(timeSignature.beatType, tpqn) * timeSignature.beats;
    const baseX = (offset + x) / zoomX;
    const cursorTick = baseXToTick(baseX, tpqn);
    const startTick = snapToGrid(cursorTick);
    const endTick = snapToGrid(startTick + oneMeasureTicks);
    void setLoopRange(startTick, endTick);
  };

  return {
    isLoopEnabled,
    loopStartTick,
    loopEndTick,
    loopStartTime,
    loopEndTime,
    setLoopEnabled,
    setLoopRange,
    clearLoopRange,
    snapToGrid,
    addOneMeasureLoop,
  };
}
