<template>
  <div v-if="isShowProgress" class="progress">
    <div v-if="isDeterminate">
      <q-circular-progress
        show-value
        :value="progress"
        :min="0"
        :max="1"
        font-size="12px"
        rounded
        color="primary"
        size="xl"
        :thickness="0.3"
      >
        {{ formattedProgress }}%
      </q-circular-progress>
      <div class="q-mt-md">生成中です...</div>
    </div>
    <div v-if="!isDeterminate">
      <q-circular-progress
        indeterminate
        color="primary"
        rounded
        :thickness="0.3"
        size="xl"
      />
      <div class="q-mt-md">生成中です...</div>
    </div>
  </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { computed, defineComponent, ref, watch } from "vue";

export default defineComponent({
  name: "ProgressDialog",

  setup() {
    const store = useStore();

    const progress = computed(() => store.getters.PROGRESS);
    const isShowProgress = ref<boolean>(false);
    const isDeterminate = ref<boolean>(false);

    watch(progress, (newValue, oldValue) => {
      if (newValue === -1) {
        isShowProgress.value = false;
      } else if (oldValue === -1 && newValue <= 1) {
        isShowProgress.value = true;
        isDeterminate.value = true;
      } else if (newValue === 1.1) {
        isShowProgress.value = true;
        isDeterminate.value = false;
      }
    });

    const formattedProgress = computed(() =>
      (store.getters.PROGRESS * 100).toFixed()
    );

    return {
      isShowProgress,
      isDeterminate,
      progress,
      formattedProgress,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles/colors' as colors;

.progress {
  background-color: rgba(colors.$display-rgb, 0.15);
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: center;

  > div {
    color: colors.$display;
    background: colors.$surface;
    width: 200px;
    border-radius: 6px;
    padding: 14px 48px;
  }
}
</style>
