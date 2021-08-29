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
          @click="selectCharacterInfIndex(undefined)"
        />
        <q-toolbar-title class="text-secondary">{{
          detailIndex === undefined
            ? "音声ライブラリの利用規約"
            : characterInfos[detailIndex].metas.name
        }}</q-toolbar-title>
      </q-toolbar>
    </q-header>
    <q-page ref="scroller" class="relative-absolute-wrapper scroller">
      <div class="q-pa-md">
        <q-list v-if="detailIndex === undefined">
          <q-item
            v-for="(characterInfo, index) in characterInfos"
            :key="index"
            clickable
            @click="selectCharacterInfIndex(index)"
          >
            <q-item-section>{{ characterInfo.metas.name }}</q-item-section>
          </q-item>
        </q-list>
        <div v-else>
          <p
            v-html="convertTextToHtml(characterInfos[detailIndex].metas.policy)"
          ></p>
        </div>
      </div>
    </q-page>
  </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { computed, defineComponent, ref } from "@vue/runtime-core";

export default defineComponent({
  setup() {
    const store = useStore();

    const characterInfos = computed(() => store.state.characterInfos);

    const convertTextToHtml = (text: string) => {
      text = text.replaceAll("\n", "<br>");
      const hoge = /https?:\/\/[a-zA-Z0-9.\-_@:/~?%&;=+#',()*!]+/g;
      return text.replaceAll(hoge, (url: string) => {
        return '<a href="' + url + '" target="_blank">' + url + "</a>";
      });
    };

    const detailIndex = ref<number | undefined>(undefined);

    const scroller = ref<any>();
    const selectCharacterInfIndex = (index: number | undefined) => {
      scroller.value!.scrollTop = 0;
      detailIndex.value = index;
    };

    return {
      characterInfos,
      convertTextToHtml,
      selectCharacterInfIndex,
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
    > div {
      overflow-wrap: break-word;
    }
  }
}
</style>
