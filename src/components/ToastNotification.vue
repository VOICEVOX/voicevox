<template>
  <div class="toast-notification">
    <div
      v-for="(toast, index) in props.modelValue"
      :key="index"
      class="toast"
      :ref="skipUnwrap.refs"
    >
      {{ toast.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { useStore } from "@/store";
import { ToastNotification } from "@/store/type";

const props = defineProps<{ modelValue: ToastNotification[] }>();

const emit =
  defineEmits<{
    (event: "update:modelValue", value: ToastNotification[]): void;
  }>();

const store = useStore();
const refs = ref<HTMLDivElement[]>();
const skipUnwrap = { refs }; // https://stackoverflow.com/questions/71414977

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (value: ToastNotification[]) => emit("update:modelValue", value),
});

const wait = async (ms: number) =>
  await new Promise((resolve) => setTimeout(resolve, ms));

watchEffect(async () => {
  const toastRefs = skipUnwrap.refs.value;
  const toastBodies = modelValueComputed.value;
  const lastIndex = toastBodies.length - 1;

  if (!toastRefs || !toastRefs[lastIndex]) return;
  const toastRef = toastRefs[lastIndex];
  const toastBody = toastBodies[lastIndex];
  const refClass = toastRef.classList;

  // fade-in
  await wait(1); // これがないと, なぜかfade-inが効かない
  refClass.add("show");

  await wait(toastBody.showMs ?? 5000);

  // Fade-out
  refClass.remove("show");
  refClass.add("hide");

  // Remove toast
  await wait(300);
  store.dispatch("POP_TOAST_NOTIFICATION");
});
</script>

<style scoped lang="scss">
@use '@/styles/colors' as colors;

.toast-notification {
  position: absolute;
  bottom: 0;
  width: 100%;
  padding-bottom: 1rem;
  text-align: center;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;

  .toast {
    width: fit-content;
    display: inline-block;
    justify-content: center;
    padding: 1rem;
    margin-bottom: 1rem;
    background-color: rgba(colors.$primary-light-rgb, 0.4);
    border-radius: 0.5rem;
    transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 0.5rem rgba(colors.$display, 0.4);
    transform: scale(0);
    opacity: 0;

    &.show {
      transform: scale(1);
      opacity: 1;
    }

    &.hide {
      transform: scale(0);
      opacity: 0;
    }
  }
}
</style>
