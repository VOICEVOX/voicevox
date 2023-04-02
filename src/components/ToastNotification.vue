<template>
  <div class="toast-notification">
    <div
      v-for="(toast, index) in props.modelValue"
      :key="index"
      class="toast"
      :ref="(el: any) => {if (el) refs[index] = el}"
    >
      {{ toast.text }}<br />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useStore } from "vuex";
import { ToastNotification } from "@/type/preload";

const props = defineProps<{ modelValue: ToastNotification[] }>();

const emit =
  defineEmits<{
    (event: "update:modelValue", value: ToastNotification[]): void;
  }>();

const store = useStore();
const refs = ref<any[]>([]);

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (value: ToastNotification[]) => emit("update:modelValue", value),
});

watch(
  () => modelValueComputed.value,
  (newToast) => {
    if (!newToast.length) return;
    const lastIndex = newToast.length - 1;
    console.log(lastIndex);
    console.log(refs.value.at(lastIndex));
    const refClass = refs.value[lastIndex].classList;

    // fade-in
    refClass.add("show");

    setTimeout(() => {
      // Fade-out
      refClass.remove("show");
      refClass.add("hide");

      // Remove toast
      setTimeout(() => {
        store.dispatch("POP_TOAST_NOTIFICATION");
      }, 300);
    }, newToast[lastIndex].showMs ?? 3000);
  }
);
</script>

<style scoped lang="scss">
@use '@/styles/colors' as colors;

.toast-notification {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 1rem;
  z-index: 1000;
  text-align: center;

  .toast {
    display: inline-block;
    justify-content: center;
    padding: 1rem;
    margin: 1rem;
    background-color: rgba(var(--color-primary-light-rgb), 0.4);
    border-radius: 0.5rem;
    transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
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
