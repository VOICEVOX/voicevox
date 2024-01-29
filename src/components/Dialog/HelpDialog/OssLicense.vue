<template>
  <q-page
    ref="scroller"
    class="relative-absolute-wrapper scroller bg-background"
  >
    <div class="q-pa-md markdown-body">
      <q-list v-if="detailIndex === undefined">
        <q-item
          v-for="(license, index) in props.licenses"
          :key="index"
          clickable
          dense
          @click="selectLicenseIndex(index)"
        >
          <q-item-section>{{
            license.name + (license.version ? " | " + license.version : "")
          }}</q-item-section>
        </q-item>
      </q-list>
      <div v-else>
        <div class="q-mb-md">
          <q-btn
            outline
            color="primary"
            icon="keyboard_arrow_left"
            label="戻る"
            @click="selectLicenseIndex(undefined)"
          />
        </div>
        <div class="text-subtitle">{{ licenses[detailIndex].name }}</div>
        <pre>{{ licenses[detailIndex].text }}</pre>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props =
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
