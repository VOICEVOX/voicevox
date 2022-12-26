<template>
  <QPage
    ref="scroller"
    class="relative-absolute-wrapper scroller bg-background"
  >
    <div class="q-pa-md markdown-body">
      <QList v-if="selectedInfo === undefined">
        <template
          v-for="(engineId, engineIndex) in sortedEngineInfos.map(
            (engineInfo) => engineInfo.uuid
          )"
          :key="engineIndex"
        >
          <!-- エンジンが一つだけの場合は名前を表示しない -->
          <template v-if="engineInfos.size > 1">
            <QSeparator spaced v-if="engineIndex > 0" />
            <QItemLabel header>{{ engineInfos.get(engineId).name }}</QItemLabel>
          </template>
          <template
            v-for="([, characterInfo], characterIndex) in engineInfos.get(
              engineId
            ).characterInfos"
            :key="characterIndex"
          >
            <QItem
              clickable
              @click="
                selectCharacterInfo({
                  engine: engineId,
                  character: characterInfo.metas.speakerUuid,
                })
              "
            >
              <QItemSection>{{ characterInfo.metas.speakerName }}</QItemSection>
            </QItem>
          </template>
        </template>
      </QList>
      <div v-else>
        <div class="q-mb-md">
          <QBtn
            outline
            color="primary-light"
            icon="keyboard_arrow_left"
            label="戻る"
            @click="selectCharacterInfo(undefined)"
          />
        </div>
        <div class="text-subtitle">
          {{
            engineInfos
              .get(selectedInfo.engine)
              .characterInfos.get(selectedInfo.character).metas.speakerName
          }}
        </div>
        <div
          class="markdown"
          v-html="
            convertMarkdown(
              engineInfos
                .get(selectedInfo.engine)
                .characterInfos.get(selectedInfo.character).metas.policy
            )
          "
        ></div>
      </div>
    </div>
  </QPage>
</template>

<script setup lang="ts">
import { useStore } from "@/store";
import { computed, ref } from "vue";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

type DetailKey = { engine: string; character: string };

const store = useStore();
const md = useMarkdownIt();
const sortedEngineInfos = computed(() => store.getters.GET_SORTED_ENGINE_INFOS);
const engineInfos = computed(
  () =>
    new Map(
      Object.entries(store.state.characterInfos).map(
        ([engineId, characterInfos]) => [
          engineId,
          {
            engineId,
            name: store.state.engineManifests[engineId].name,
            characterInfos: new Map(
              characterInfos.map((ci) => [ci.metas.speakerUuid, ci])
            ),
          },
        ]
      )
    )
);
const convertMarkdown = (text: string) => {
  return md.render(text);
};
const selectedInfo = ref<DetailKey | undefined>(undefined);
const scroller = ref<HTMLElement>();
const selectCharacterInfo = (index: DetailKey | undefined) => {
  if (scroller.value == undefined)
    throw new Error("scroller.value == undefined");
  scroller.value.scrollTop = 0;
  selectedInfo.value = index;
};
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
