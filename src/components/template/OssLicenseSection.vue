<template>
  <div class="container">
    <div v-if="detailIndex === undefined" class="inner inner-list">
      <h1 class="headline">ライセンス情報</h1>
      <div class="list">
        <BaseRowCard
          v-for="(license, index) in props.licenses"
          :key="index"
          :title="
            license.name + (license.version ? ' | ' + license.version : '')
          "
          clickable
          @click="selectLicenseIndex(index)"
        >
          <q-icon name="arrow_right" size="sm" />
        </BaseRowCard>
      </div>
    </div>
    <div v-else class="inner inner-detail">
      <div>
        <BaseButton
          label="戻る"
          icon="keyboard_arrow_left"
          @click="selectLicenseIndex(undefined)"
        />
      </div>
      <h1 class="headline">{{ licenses[detailIndex].name }}</h1>
      <pre>{{ licenses[detailIndex].text }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import BaseRowCard from "../base/BaseRowCard.vue";
import BaseButton from "../base/BaseButton.vue";

const props =
  defineProps<{
    licenses: Record<string, string>[];
  }>();

const detailIndex = ref<number | undefined>(undefined);

const selectLicenseIndex = (index: number | undefined) => {
  detailIndex.value = index;
};
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.container {
  // 親コンポーネントからheightを取得できないため一時的にcalcを使用、HelpDialogの構造を再設計後100%に変更する
  // height: 100%;
  height: calc(100vh - 90px);
  overflow-y: auto;
  background-color: #e9f3e7;
}

.inner {
  display: flex;
  flex-direction: column;
  padding: vars.$padding-container;
  gap: vars.$gap-container;
  min-height: 100%;
}

.inner-detail {
  background-color: #fff;
}

.headline {
  font-size: 1.5rem;
  line-height: 1;
  margin: 0;
}

.list {
  display: flex;
  flex-direction: column;
  gap: vars.$gap-control;
}
</style>
