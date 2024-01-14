import { Ref, ref } from "vue";
import { isMac } from "@/type/preload";

const createUseKey = (key: string) => (): Ref<boolean> => {
  const isActive = ref(false);
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === key) {
      isActive.value = true;
    }
  };
  const onKeyup = (e: KeyboardEvent) => {
    if (e.key === key) {
      isActive.value = false;
    }
  };
  const onBlur = () => {
    isActive.value = false;
  };
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("keyup", onKeyup);
  window.addEventListener("blur", onBlur);
  return isActive;
};

/** Shiftキーが押されているかどうかを返す */
export const useShiftKey = createUseKey("Shift");
/** Altキー（MacではOptionキー）が押されているかどうかを返す */
export const useAltKey = createUseKey("Alt");

const useMetaKey = createUseKey("Meta");
const useControlKey = createUseKey("Control");

/** Ctrlキー（MacではCommandキー）が押されているかどうかを返す */
export const useCommandOrControlKey = () => {
  if (isMac) {
    return useMetaKey();
  }
  return useControlKey();
};
