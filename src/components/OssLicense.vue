<template>
  <QPage
    ref="scroller"
    class="relative-absolute-wrapper scroller bg-background"
  >
    <div class="q-pa-md markdown-body">
      <QList v-if="detailIndex === undefined">
        <QItem
          v-for="(license, index) in licenses"
          :key="index"
          clickable
          dense
          @click="selectLicenseIndex(index)"
        >
          <QItemSection>{{
            license.name + (license.version ? " | " + license.version : "")
          }}</QItemSection>
        </QItem>
      </QList>
      <div v-else>
        <div class="q-mb-md">
          <QBtn
            outline
            color="primary-light"
            icon="keyboard_arrow_left"
            label="戻る"
            @click="selectLicenseIndex(undefined)"
          />
        </div>
        <div class="text-subtitle">{{ licenses[detailIndex].name }}</div>
        <pre>{{ licenses[detailIndex].text }}</pre>
      </div>
    </div>
  </QPage>
</template>

<script setup lang="ts">
import { ref } from "vue";

defineProps<{
  licenses: Record<string, string>[];
}>();
const detailIndex = ref<number | undefined>(undefined);

const scroller = ref<HTMLElement>();

const selectLicenseIndex = (index: number | undefined) => {
  if (scroller.value == undefined)
    throw new Error("scroller.value == undefined");
  scroller.value.scrollTop = 0;
  detailIndex.value = index;
};
</script>

<style scoped lang="scss">
.root {
  .scroller {
    width: 100%;
    overflow: auto;
  }
}
</style>
