import { ref, onMounted } from "vue";

/**
 * マウントしたときにtrueになるフラグを提供する。
 * マウントしてすぐ一度だけ処理を実行したいときに便利。
 */
export function useMounted() {
  const mounted = ref(false);

  onMounted(() => {
    mounted.value = true;
  });

  return { mounted };
}
