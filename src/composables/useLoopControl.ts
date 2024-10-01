// useLoopControl.ts
import { computed } from "vue";
import { useStore } from "@/store";
import { tickToSecond } from "@/sing/domain";

export function useLoopControl() {
  const store = useStore();

  const isLoopEnabled = computed({
    get: () => store.state.isLoopEnabled,
    set: (value) => store.commit("SET_LOOP_ENABLED", { isLoopEnabled: value }),
  });

  const loopStartTick = computed({
    get: () => store.state.loopStartTick,
    set: (value) => store.commit("SET_LOOP_START", { loopStartTick: value }),
  });

  const loopEndTick = computed({
    get: () => store.state.loopEndTick,
    set: (value) => store.commit("SET_LOOP_END", { loopEndTick: value }),
  });

  const setLoopEnabled = (value: boolean) => {
    void store.dispatch("SET_LOOP_ENABLED", { isLoopEnabled: value });
  };

  const setLoopRange = (startTick: number, endTick: number) => {
    void store.dispatch("SET_LOOP_RANGE", {
      loopStartTick: startTick,
      loopEndTick: endTick,
    });
  };

  const loopStartTime = computed(() =>
    tickToSecond(loopStartTick.value, store.state.tempos, store.state.tpqn),
  );

  const loopEndTime = computed(() =>
    tickToSecond(loopEndTick.value, store.state.tempos, store.state.tpqn),
  );

  const handleLoop = (currentTime: number) => {
    if (!isLoopEnabled.value || loopEndTick.value <= 0) return currentTime;

    if (currentTime >= loopEndTime.value) {
      return (
        loopStartTime.value +
        ((currentTime - loopStartTime.value) %
          (loopEndTime.value - loopStartTime.value))
      );
    }

    return currentTime;
  };

  return {
    isLoopEnabled,
    loopStartTick,
    loopEndTick,
    setLoopEnabled,
    setLoopRange,
    handleLoop,
  };
}
