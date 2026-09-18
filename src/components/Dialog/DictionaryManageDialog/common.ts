import { computed, ref } from "vue";

const uiLockCount = ref(0);

export function lockUi(): { [Symbol.dispose]: () => void } {
  uiLockCount.value++;
  return {
    [Symbol.dispose]: () => {
      uiLockCount.value--;
    },
  };
}

export async function lockUiWhile<T>(promise: Promise<T>): Promise<T> {
  const lock = lockUi();
  try {
    return await promise;
  } finally {
    lock[Symbol.dispose]();
  }
}

export const uiLocked = computed(() => uiLockCount.value > 0);
