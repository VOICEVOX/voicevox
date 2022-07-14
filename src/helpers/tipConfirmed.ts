import { useStore } from "@/store";
import { ConfirmedTips } from "@/type/preload";
import { computed, WritableComputedRef } from "vue";

export const tipConfirmed = (
  key: keyof ConfirmedTips
): WritableComputedRef<boolean> => {
  const store = useStore();

  return computed({
    get: () => store.state.confirmedTips[key],
    set: (value) =>
      store.dispatch("SET_CONFIRMED_TIPS", {
        confirmedTips: {
          ...store.state.confirmedTips,
          [key]: value,
        },
      }),
  });
};
