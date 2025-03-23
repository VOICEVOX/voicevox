import { ref, onMounted } from "vue";

export function useMounted() {
  const mounted = ref(false);

  onMounted(() => {
    mounted.value = true;
  });

  return { mounted };
}
