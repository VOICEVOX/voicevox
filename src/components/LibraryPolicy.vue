<template>
  <q-page
    ref="scroller"
    class="relative-absolute-wrapper scroller bg-background"
  >
    <div class="q-pa-md markdown-body">
      <q-list v-if="detailUuid === undefined">
        <template
          v-for="([characterUuid, characterInfo], index) in characterInfos"
          :key="index"
        >
          <q-item clickable @click="selectCharacterInfo(characterUuid)">
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
            @click="selectCharacterInfo(undefined)"
          />
        </div>
        <div class="text-subtitle">
          {{ characterInfos.get(detailUuid).metas.speakerName }}
        </div>
        <div
          class="markdown"
          v-html="convertMarkdown(characterInfos.get(detailUuid).metas.policy)"
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

    const allCharacterInfos = computed(
      () => store.getters.GET_ALL_CHARACTER_INFOS
    );

    const convertMarkdown = (text: string) => {
      return md.render(text);
    };

    const detailUuid = ref<string | undefined>(undefined);

    const scroller = ref<HTMLElement>();
    const selectCharacterInfo = (index: string | undefined) => {
      if (scroller.value == undefined)
        throw new Error("scroller.value == undefined");
      scroller.value.scrollTop = 0;
      detailUuid.value = index;
    };

    return {
      characterInfos: allCharacterInfos,
      convertMarkdown,
      selectCharacterInfo,
      detailUuid,
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
