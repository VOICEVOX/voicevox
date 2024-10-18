import { computed } from "vue";
import { useStore } from "@/store";
import { tickToSecond } from "@/sing/domain";

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
      await store.dispatch("SET_LOOP_ENABLED", { isLoopEnabled: value });
    } catch (error) {
      throw new Error("Failed to set loop enabled state");
    }
  };

  const setLoopRange = async (
    startTick: number,
    endTick: number,
  ): Promise<void> => {
    if (startTick < 0 || endTick < startTick) {
      throw new Error("Invalid loop range");
    }

    try {
      await store.dispatch("SET_LOOP_RANGE", {
        loopStartTick: startTick,
        loopEndTick: endTick,
      });
    } catch (error) {
      throw new Error("Failed to set loop range");
    }
  };

  return {
    isLoopEnabled,
    loopStartTick,
    loopEndTick,
    loopStartTime,
    loopEndTime,
    setLoopEnabled,
    setLoopRange,
  };
}
