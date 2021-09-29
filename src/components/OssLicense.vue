<template>
  <div class="root">
    <q-header class="q-py-sm">
      <q-toolbar>
        <q-btn
          unelevated
          label="戻る"
          color="white"
          text-color="secondary"
          :disable="detailIndex === undefined"
          @click="selectLicenseIndex(undefined)"
        />
        <q-toolbar-title class="text-secondary">{{
          detailIndex === undefined
            ? "OSSライセンス情報"
            : licenses[detailIndex].name
        }}</q-toolbar-title>
      </q-toolbar>
    </q-header>
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
          <pre>{{ licenses[detailIndex].text }}</pre>
        </div>
      </div>
    </q-page>
  </div>
</template>

<script lang="ts">
import { GET_OSS_LICENSES, useStore } from "@/store";
import { defineComponent, ref } from "vue";

export default defineComponent({
  name: "OssLicense",

  setup() {
    const store = useStore();

    let licenses = ref<Record<string, string>[]>();
    store
      .dispatch(GET_OSS_LICENSES, undefined)
      .then((obj) => (licenses.value = obj));

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
