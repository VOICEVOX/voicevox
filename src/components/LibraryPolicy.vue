<template>
  <div class="root">
    <mcw-top-app-bar class="main-toolbar">
      <div class="mdc-top-app-bar__row">
        <section
          class="mdc-top-app-bar__section mdc-top-app-bar__section--align-start"
        >
          <mcw-button
            @click="selectCharactorInfIndex(undefined)"
            :disabled="detailIndex === undefined"
            unelevated
            >戻る</mcw-button
          >
          <span class="mdc-top-app-bar__title">{{
            detailIndex === undefined
              ? "音声ライブラリの利用規約"
              : charactorInfos[detailIndex].metas.name
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
          @update:modelValue="selectCharactorInfIndex"
        >
          <mcw-list-item
            v-for="(charactorInfo, index) in charactorInfos"
            :key="index"
            >{{ charactorInfo.metas.name }}</mcw-list-item
          >
        </mcw-list>
        <div v-else>
          <p
            v-html="convertTextToHtml(charactorInfos[detailIndex].metas.policy)"
          ></p>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { computed, defineComponent, ref } from "@vue/runtime-core";

export default defineComponent({
  setup() {
    const store = useStore();

    const charactorInfos = computed(() => store.state.charactorInfos);

    const convertTextToHtml = (text: string) => {
      text = text.replaceAll("\n", "<br>");
      const hoge = /https?:\/\/[a-zA-Z0-9.\-_@:/~?%&;=+#',()*!]+/g;
      return text.replaceAll(hoge, (url: string) => {
        return '<a href="' + url + '" target="_blank">' + url + "</a>";
      });
    };

    const detailIndex = ref<number | undefined>(undefined);

    const scroller = ref<any>();
    const selectCharactorInfIndex = (index: number | undefined) => {
      scroller.value!.scrollTop = 0;
      detailIndex.value = index;
    };

    return {
      charactorInfos,
      convertTextToHtml,
      selectCharactorInfIndex,
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
