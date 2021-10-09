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
    <q-page ref="scroller" class="relarive-absolute-wrapper scroller">
      <div class="q-pa-md">
        <q-list v-if="detailIndex === undefined">
          <!-- TODO: スタイルとキャラクターが一対一対応してしまって同じキャラクターのライセンスが表示されてしまう -->
          <!-- というのを防ぐために、スタイル数の4ごとにライセンスを表示する。 -->
          <template
            v-for="(characterInfo, index) in characterInfos"
            :key="index"
          >
            <q-item
              v-if="index % 4 == 0"
              clickable
              @click="selectCharacterInfIndex(index)"
            >
              <q-item-section>{{ characterInfo.metas.name }}</q-item-section>
            </q-item>
          </template>
        </q-list>
        <div
          v-else
          class="markdown"
          v-html="convertMarkdown(characterInfos[detailIndex].metas.policy)"
        ></div>
      </div>
    </q-page>
  </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { computed, defineComponent, ref } from "@vue/runtime-core";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

export default defineComponent({
  setup() {
    const store = useStore();
    const md = useMarkdownIt();

    const characterInfos = computed(() => store.state.characterInfos);

    const convertMarkdown = (text: string) => {
      return md.render(text);
    };

    const detailIndex = ref<number | undefined>(undefined);

    const scroller = ref<any>();
    const selectCharacterInfIndex = (index: number | undefined) => {
      scroller.value!.scrollTop = 0;
      detailIndex.value = index;
    };

    return {
      characterInfos,
      convertMarkdown,
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
