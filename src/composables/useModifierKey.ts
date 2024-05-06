import {
  Ref,
  ref,
  onUnmounted,
  onMounted,
  MaybeRefOrGetter,
  toValue,
} from "vue";
import { isMac } from "@/type/preload";

type Target = EventTarget & GlobalEventHandlers;

const useCreateUseKey = (
  key: string,
  _target: MaybeRefOrGetter<Target> = window,
): Ref<boolean> => {
  const target = toValue(_target);

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

  onMounted(() => {
    target.addEventListener("keydown", onKeydown);
    target.addEventListener("keyup", onKeyup);
    target.addEventListener("blur", onBlur);
  });

  onUnmounted(() => {
    target.removeEventListener("keydown", onKeydown);
    target.removeEventListener("keyup", onKeyup);
    target.removeEventListener("blur", onBlur);
  });

  return isActive;
};

/** Shiftキーが押されているかどうかを返す */
export const useShiftKey = (target: Target = window) =>
  useCreateUseKey("Shift", target);

/** Altキー（MacではOptionキー）が押されているかどうかを返す */
export const useAltKey = (target: Target = window) =>
  useCreateUseKey("Alt", target);

const useMetaKey = (target: Target = window) => useCreateUseKey("Meta", target);
const useControlKey = (target: Target = window) =>
  useCreateUseKey("Control", target);

/** Ctrlキー（MacではCommandキー）が押されているかどうかを返す */
export const useCommandOrControlKey = (target: Target = window) => {
  if (isMac) {
    return useMetaKey(target);
  }
  return useControlKey(target);
};
