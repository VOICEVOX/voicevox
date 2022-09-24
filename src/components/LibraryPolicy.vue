<template>
  <q-page
    ref="scroller"
    class="relative-absolute-wrapper scroller bg-background"
  >
    <div class="q-pa-md markdown-body">
      <q-list v-if="detailIndex === undefined">
        <template
          v-for="(engineInfo, engineIndex) in engineInfos"
          :key="engineIndex"
        >
          <!-- エンジンが一つだけの場合は名前を表示しない -->
          <template v-if="engineInfos.length > 1">
            <q-separator spaced v-if="engineIndex > 0" />
            <q-item-label header>{{ engineInfo.engineName }}</q-item-label>
          </template>
          <template
            v-for="(characterInfo, characterIndex) in engineInfo.characterInfos"
            :key="characterIndex"
          >
            <q-item
              clickable
              @click="
                selectCharacterInfo({
                  engine: engineIndex,
                  character: characterIndex,
                })
              "
            >
              <q-item-section>{{
                characterInfo.metas.speakerName
              }}</q-item-section>
            </q-item>
          </template>
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
          {{
            engineInfos[detailIndex.engine].characterInfos[
              detailIndex.character
            ].metas.speakerName
          }}
        </div>
        <div
          class="markdown"
          v-html="
            convertMarkdown(
              engineInfos[detailIndex.engine].characterInfos[
                detailIndex.character
              ].metas.policy
            )
          "
        ></div>
      </div>
    </div>
  </q-page>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { computed, defineComponent, ref } from "@vue/runtime-core";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

type DetailKey = { engine: number; character: number };

export default defineComponent({
  setup() {
    const store = useStore();
    const md = useMarkdownIt();

    const engineInfos = computed(() =>
      Object.entries(store.state.characterInfos).map(
        ([engineId, characterInfos]) => ({
          engineId,
          engineName: store.state.engineManifests[engineId].name,
          characterInfos,
        })
      )
    );

    const convertMarkdown = (text: string) => {
      return md.render(text);
    };

    const detailIndex = ref<DetailKey | undefined>(undefined);

    const scroller = ref<HTMLElement>();
    const selectCharacterInfo = (index: DetailKey | undefined) => {
      if (scroller.value == undefined)
        throw new Error("scroller.value == undefined");
      scroller.value.scrollTop = 0;
      detailIndex.value = index;
    };

    return {
      engineInfos,
      convertMarkdown,
      selectCharacterInfo,
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
