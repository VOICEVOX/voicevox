<template>
  <q-page ref="scroller" class="relarive-absolute-wrapper scroller">
    <div class="q-pa-md">
      <q-list v-if="detailIndex === undefined">
        <template v-for="(characterInfo, index) in characterInfos" :key="index">
          <q-item clickable @click="selectCharacterInfIndex(index)">
            <q-item-section>{{
              characterInfo.metas.speakerName
            }}</q-item-section>
          </q-item>
        </template>
      </q-list>
      <div v-else>
        <div class="q-mb-md">
          <q-btn
            outline
            style="color: #a5d4ad"
            icon="keyboard_arrow_left"
            label="前画面に戻る"
            @click="selectCharacterInfIndex(undefined)"
          />
        </div>
        <div class="text-subtitle">
          {{ characterInfos[detailIndex].metas.speakerName }}
        </div>
        <div
          class="markdown"
          v-html="convertMarkdown(characterInfos[detailIndex].metas.policy)"
        ></div>
      </div>
    </div>
  </q-page>
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
