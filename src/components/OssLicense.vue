<template>
  <q-page ref="scroller" class="relarive-absolute-wrapper scroller">
    <div class="q-pa-md">
      <q-list v-if="detailIndex === undefined">
        <q-item
          v-for="(license, index) in licenses"
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
            style="color: #a5d4ad"
            icon="keyboard_arrow_left"
            label="前画面に戻る"
            @click="selectLicenseIndex(undefined)"
          />
        </div>
        <div class="text-subtitle">{{ licenses[detailIndex].name }}</div>
        <pre>{{ licenses[detailIndex].text }}</pre>
      </div>
    </div>
  </q-page>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { defineComponent, ref } from "vue";

export default defineComponent({
  name: "OssLicense",

  setup() {
    const store = useStore();

    let licenses = ref<Record<string, string>[]>();
    store.dispatch("GET_OSS_LICENSES").then((obj) => (licenses.value = obj));

    const detailIndex = ref<number | undefined>(undefined);

    const scroller = ref<any>();
    const selectLicenseIndex = (index: number | undefined) => {
      scroller.value!.scrollTop = 0;
      detailIndex.value = index;
    };

    return {
      licenses,
      selectLicenseIndex,
      detailIndex,
      scroller,
    };
  },
});
</script>

<style scoped lang="scss">
.root {
  .scroller {
    width: 100%;
    overflow: auto;
  }
}
</style>
