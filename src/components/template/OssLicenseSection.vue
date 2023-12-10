<template>
  <div v-if="detailIndex == undefined" class="container">
    <BaseScrollArea>
      <div class="inner inner-list">
        <h1 class="title">ライセンス情報</h1>
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
            <q-icon name="keyboard_arrow_right" size="sm" />
          </BaseRowCard>
        </div>
      </div>
    </BaseScrollArea>
  </div>
  <div v-else class="container container-detail">
    <BaseScrollArea>
      <div class="inner">
        <div>
          <BaseButton
            label="戻る"
            icon="keyboard_arrow_left"
            @click="selectLicenseIndex(undefined)"
          />
        </div>
        <h1 class="title">{{ licenses[detailIndex].name }}</h1>
        <pre>{{ licenses[detailIndex].text }}</pre>
      </div>
    </BaseScrollArea>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import BaseRowCard from "../base/BaseRowCard.vue";
import BaseButton from "../base/BaseButton.vue";
import BaseScrollArea from "../base/BaseScrollArea.vue";

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
@use '@/styles/mixin' as mixin;

.container {
  // 親コンポーネントからheightを取得できないため一時的にcalcを使用、HelpDialogの構造を再設計後100%に変更する
  // height: 100%;
  height: calc(100vh - 90px);
  background-color: #e9f3e7;
}

.container-detail {
  background-color: #fff;
}

.inner {
  display: flex;
  flex-direction: column;
  padding: vars.$padding-container;
  gap: vars.$gap-container;
}

.title {
  @include mixin.headline-1;
}

.list {
  display: flex;
  flex-direction: column;
  gap: vars.$gap-control;
}
</style>
