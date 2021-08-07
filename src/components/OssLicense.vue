<template>
  <div class="root">
    <mcw-top-app-bar class="main-toolbar">
      <div class="mdc-top-app-bar__row">
        <section
          class="mdc-top-app-bar__section mdc-top-app-bar__section--align-start"
        >
          <mcw-button
            @click="selectLicenseIndex(undefined)"
            :disabled="detailIndex === undefined"
            unelevated
            >戻る</mcw-button
          >
          <span class="mdc-top-app-bar__title">{{
            detailIndex === undefined
              ? "OSSライセンス情報"
              : licenses[detailIndex].name
          }}</span>
        </section>
      </div>
    </mcw-top-app-bar>
    <div
      ref="scroller"
      class="scroller mdc-top-app-bar--fixed-adjust relarive-absolute-wrapper"
    >
      <div>
        <mcw-list
          v-if="detailIndex === undefined"
          @update:modelValue="selectLicenseIndex"
          dense
        >
          <mcw-list-item v-for="(license, index) in licenses" :key="index">{{
            license.name + (license.version ? " | " + license.version : "")
          }}</mcw-list-item>
        </mcw-list>
        <div v-else>
          <pre>{{ licenses[detailIndex].text }}</pre>
        </div>
      </div>
    </div>
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
    store.dispatch(GET_OSS_LICENSES).then((obj) => (licenses.value = obj));

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
  width: 100%;
  display: flex;
  flex-direction: column;
}

.scroller {
  width: 100%;
  overflow: auto;
  > div {
    margin: 1rem;
  }
}
</style>
