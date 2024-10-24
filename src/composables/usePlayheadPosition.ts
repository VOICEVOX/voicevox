import { onMounted, onUnmounted, ref, watch } from "vue";
import { useStore } from "@/store";

export const usePlayheadPosition = () => {
  const store = useStore();

  let _playheadPosition = store.getters.GET_PLAYHEAD_POSITION();
  const playheadPosition = ref(_playheadPosition);

  const playheadPositionchangeListener = (position: number) => {
    _playheadPosition = position;
    playheadPosition.value = position;
  };

  watch(playheadPosition, (newValue) => {
    if (newValue !== _playheadPosition) {
      void store.dispatch("SET_PLAYHEAD_POSITION", { position: newValue });
    }
  });

  onMounted(() => {
    void store.dispatch("ADD_PLAYHEAD_POSITION_CHANGE_LISTENER", {
      listener: playheadPositionchangeListener,
    });
  });

  onUnmounted(() => {
    void store.dispatch("REMOVE_PLAYHEAD_POSITION_CHANGE_LISTENER", {
      listener: playheadPositionchangeListener,
    });
  });

  return playheadPosition;
};
