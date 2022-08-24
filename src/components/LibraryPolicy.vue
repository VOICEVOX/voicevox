<template>
  <q-page
    ref="scroller"
    class="relative-absolute-wrapper scroller bg-background"
  >
    <div class="q-pa-md markdown-body">
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
            color="primary-light"
            icon="keyboard_arrow_left"
            label="戻る"
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

    const flattenCharacterInfos = computed(
      () => store.getters.GET_FLATTEN_CHARACTER_INFOS
    );

    const convertMarkdown = (text: string) => {
      return md.render(text);
    };

    const detailIndex = ref<number | undefined>(undefined);

    const scroller = ref<HTMLElement>();
    const selectCharacterInfIndex = (index: number | undefined) => {
      if (scroller.value == undefined)
        throw new Error("scroller.value == undefined");
      scroller.value.scrollTop = 0;
      detailIndex.value = index;
    };

    return {
      characterInfos: flattenCharacterInfos,
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
