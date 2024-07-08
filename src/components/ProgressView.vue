<template>
  <div v-if="isShowProgress" class="progress">
    <div>
      <QCircularProgress
        v-if="isDeterminate"
        showValue
        :value="progress"
        :min="0"
        :max="1"
        rounded
        font-size="12px"
        color="primary"
        size="xl"
        :thickness="0.3"
      >
        {{ formattedProgress }}%
      </QCircularProgress>
      <QCircularProgress
        v-if="!isDeterminate"
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

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useStore } from "@/store";

const store = useStore();

const progress = computed(() => store.getters.PROGRESS);
const isShowProgress = ref<boolean>(false);
const isDeterminate = ref<boolean>(false);

let timeoutId: ReturnType<typeof setTimeout>;

const deferredProgressStart = () => {
  // 3秒待ってから表示する
  timeoutId = setTimeout(() => {
    isShowProgress.value = true;
  }, 3000);
};

watch(progress, (newValue, oldValue) => {
  if (newValue === -1) {
    // → 非表示
    clearTimeout(timeoutId);
    isShowProgress.value = false;
  } else if (oldValue === -1 && newValue <= 1) {
    // 非表示 → 処理中
    deferredProgressStart();
    isDeterminate.value = false;
  } else if (oldValue !== -1 && 0 < newValue) {
    // 処理中 → 処理中(0%より大きな値)
    // 0 < value <= 1の間のみ進捗を%で表示する
    isDeterminate.value = true;
  }
});

onUnmounted(() => clearTimeout(timeoutId));

const formattedProgress = computed(() =>
  (store.getters.PROGRESS * 100).toFixed(),
);
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as colors;

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
